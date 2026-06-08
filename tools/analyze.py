#!/usr/bin/env python3
"""Dependency-free C# architecture extractor for the DawnHolder visualizer."""

from __future__ import annotations

import argparse
import bisect
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


TYPE_RE = re.compile(
    r"(?m)^[ \t]*(?P<mods>(?:(?:public|internal|private|protected|sealed|static|abstract|partial|readonly|ref|new)\s+)*)"
    r"(?P<kind>class|interface|struct|enum|record(?:\s+struct)?)\s+"
    r"(?P<name>[A-Za-z_]\w*)(?:\s*<[^>{;]+>)?"
    r"(?:\s*\([^;{}]*\))?"
    r"(?:\s*:\s*(?P<bases>[^\n{]+?))?\s*(?:where\s+[^\n{]+\s*)?(?P<open>\{|;)",
)
METHOD_RE = re.compile(
    r"(?m)^[ \t]*(?P<mods>(?:(?:public|internal|private|protected|static|virtual|override|abstract|sealed|async|extern|new|partial)\s+)*)"
    r"(?:(?P<return>[A-Za-z_][\w.<>,?\[\] ]*)\s+)?(?P<name>[A-Za-z_]\w*)\s*"
    r"\((?P<params>[^()]*)\)\s*(?:where\s+[^\n{=>;]+\s*)?(?P<open>\{|=>|;)",
)
PROPERTY_RE = re.compile(
    r"(?m)^[ \t]*(?P<mods>(?:(?:public|internal|private|protected|static|virtual|override|abstract|sealed|new|readonly)\s+)*)"
    r"(?P<type>[A-Za-z_][\w.<>,?\[\] ]*)\s+(?P<name>[A-Za-z_]\w*)\s*\{\s*(?:get|set|init)\b"
)
FIELD_RE = re.compile(
    r"(?m)^[ \t]*(?P<mods>(?:(?:public|internal|private|protected|static|readonly|const|volatile|new)\s+)*)"
    r"(?P<type>[A-Za-z_][\w.<>,?\[\]]*)\s+(?P<name>_?[A-Za-z_]\w*)\s*(?:=|;|,)"
)
CALL_RE = re.compile(r"(?<!\bnew\s)(?:(?P<receiver>[A-Za-z_]\w*)\s*\.)?(?P<name>[A-Za-z_]\w*)\s*\(")
LOCAL_RE = re.compile(r"\b(?P<type>[A-Za-z_]\w*(?:<[^;=()]+>)?)\s+(?P<name>_?[A-Za-z_]\w*)\s*(?:=|;|,)")
NAMESPACE_RE = re.compile(r"\bnamespace\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*[;{]")

CONTROL_WORDS = {
    "if", "for", "foreach", "while", "switch", "catch", "using", "lock", "return",
    "nameof", "typeof", "sizeof", "checked", "unchecked", "default", "new", "base", "this",
}
IGNORED_TYPES = {
    "void", "bool", "byte", "sbyte", "short", "ushort", "int", "uint", "long", "ulong",
    "float", "double", "decimal", "char", "string", "object", "var", "dynamic", "Task",
    "ValueTask", "Action", "Func", "List", "Dictionary", "HashSet", "Queue", "Stack",
    "IEnumerable", "IReadOnlyList", "IReadOnlyCollection", "ICollection", "Nullable",
    "Vector2", "Vector3", "GameObject", "Transform", "CancellationToken",
}
RESPONSIBILITY_KEYWORDS = {
    "Network": ("packet", "send", "receive", "recv", "socket", "session", "broadcast", "connect", "handshake"),
    "Combat": ("attack", "combat", "damage", "hit", "death", "cooldown", "stageclear"),
    "Movement": ("move", "position", "velocity", "jump", "predict", "reconcile", "terrain"),
    "AI": ("ai", "patrol", "aggro", "chase", "state", "respawn"),
    "Map/World": ("map", "world", "portal", "migration", "spawn", "entity", "zone"),
    "UI/Rendering": ("ui", "render", "view", "visual", "animator", "camera", "scene", "hud", "prefab"),
    "Persistence": ("database", "db", "save", "load", "repository", "persist"),
    "Lifecycle": ("awake", "start", "update", "destroy", "enable", "disable", "dispose", "initialize"),
    "Tooling/Test": ("test", "smoke", "probe", "generator", "fixture", "scenario"),
    "Audio": ("audio", "music", "midi", "wave", "sound", "synth"),
}


@dataclass
class SourceFile:
    path: Path
    relative: str
    source: str
    masked: str
    newlines: list[int]
    is_test: bool
    is_generated: bool

    def line(self, position: int) -> int:
        return bisect.bisect_right(self.newlines, position) + 1


def mask_non_code(source: str) -> str:
    chars = list(source)
    i = 0
    state = "code"
    while i < len(chars):
        current = chars[i]
        nxt = chars[i + 1] if i + 1 < len(chars) else ""
        if state == "code":
            if current == "/" and nxt == "/":
                chars[i] = chars[i + 1] = " "
                i += 2
                state = "line"
                continue
            if current == "/" and nxt == "*":
                chars[i] = chars[i + 1] = " "
                i += 2
                state = "block"
                continue
            if current == '"':
                chars[i] = " "
                i += 1
                state = "string"
                continue
            if current == "'":
                chars[i] = " "
                i += 1
                state = "char"
                continue
        elif state == "line":
            if current == "\n":
                state = "code"
            else:
                chars[i] = " "
        elif state == "block":
            if current == "*" and nxt == "/":
                chars[i] = chars[i + 1] = " "
                i += 2
                state = "code"
                continue
            if current != "\n":
                chars[i] = " "
        elif state in {"string", "char"}:
            quote = '"' if state == "string" else "'"
            if current == "\\":
                chars[i] = " "
                if i + 1 < len(chars):
                    if chars[i + 1] != "\n":
                        chars[i + 1] = " "
                    i += 2
                    continue
            if current == quote:
                chars[i] = " "
                state = "code"
            elif current != "\n":
                chars[i] = " "
        i += 1
    return "".join(chars)


def matching_brace(text: str, opening: int) -> int:
    depth = 0
    for index in range(opening, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return index
    return len(text) - 1


def clean_type(raw: str) -> str:
    value = raw.strip().replace("global::", "")
    value = re.sub(r"\[\]$|\?$", "", value)
    value = value.split("<", 1)[0].strip()
    return value.rsplit(".", 1)[-1]


def split_params(raw: str) -> list[dict]:
    if not raw.strip():
        return []
    params = []
    for part in raw.split(","):
        tokens = [token for token in part.strip().split() if token not in {"ref", "out", "in", "params", "this"}]
        if len(tokens) >= 2:
            params.append({"name": tokens[-1].split("=")[0], "type": " ".join(tokens[:-1])})
    return params


def layer_for(path: str) -> str:
    if path.startswith("02_Server"): return "Server"
    if path.startswith("03_Client"): return "Client"
    if path.startswith("04_ClientNet"): return "ClientNet"
    if path.startswith("98_Shared"): return "Shared"
    if path.startswith("99_Tools/PacketGenerator"): return "Tool"
    return "Other"


def direct_depths(body: str) -> list[int]:
    depth = 0
    result = [0] * (len(body) + 1)
    for index, char in enumerate(body):
        result[index] = depth
        if char == "{": depth += 1
        elif char == "}": depth = max(0, depth - 1)
    result[len(body)] = depth
    return result


class Analyzer:
    def __init__(self, source_root: Path, config: dict):
        self.source_root = source_root
        self.config = config
        self.files: list[SourceFile] = []
        self.types: list[dict] = []
        self.methods: list[dict] = []
        self.relations: list[dict] = []
        self.diagnostics: list[dict] = []
        self.types_by_name: dict[str, list[dict]] = defaultdict(list)
        self.types_by_id: dict[str, dict] = {}
        self.methods_by_id: dict[str, dict] = {}
        self.relation_keys: set[tuple[str, str, str]] = set()

    def run(self) -> dict:
        self.read_files()
        self.extract_types()
        self.index_models()
        self.extract_dependencies()
        self.extract_calls()
        self.calculate_metrics()
        self.detect_cycles()
        self.detect_patterns()
        self.sort_models()
        projects = []
        for layer in sorted({item["layer"] for item in self.types}):
            layer_types = [item for item in self.types if item["layer"] == layer]
            layer_ids = {item["id"] for item in layer_types}
            projects.append({
                "name": layer,
                "types": len(layer_types),
                "methods": sum(item["methodCount"] for item in layer_types),
                "diagnostics": sum(item["typeId"] in layer_ids for item in self.diagnostics),
            })
        return {
            "schemaVersion": "1.0",
            "generatedAtUtc": self.source_snapshot_time(),
            "sourceRoot": str(self.source_root).replace("\\", "/"),
            "summary": {
                "files": len(self.files),
                "types": len(self.types),
                "methods": len(self.methods),
                "relations": len(self.relations),
                "diagnostics": len(self.diagnostics),
                "highSeverity": sum(item["severity"] == "high" for item in self.diagnostics),
                "mediumSeverity": sum(item["severity"] == "medium" for item in self.diagnostics),
            },
            "projects": projects,
            "types": self.types,
            "methods": self.methods,
            "relations": self.relations,
            "diagnostics": self.diagnostics,
            "legend": {
                "inherits": "Class inheritance",
                "implements": "Interface implementation",
                "uses": "Member, parameter, return, or local type dependency",
                "creates": "Direct object creation",
                "calls": "Heuristically resolved cross-type method invocation",
                "high": "Strong review signal",
                "medium": "Context-dependent review signal",
            },
        }

    def source_snapshot_time(self) -> str:
        if not self.files:
            return datetime.fromtimestamp(0, timezone.utc).isoformat()
        latest_mtime = max(file.path.stat().st_mtime for file in self.files)
        return datetime.fromtimestamp(latest_mtime, timezone.utc).isoformat()

    def read_files(self) -> None:
        excludes = tuple(self.config.get("excludeSegments", []))
        include_tests = self.config.get("includeTests", True)
        test_markers = tuple(self.config.get("testMarkers", []))
        generated_markers = tuple(self.config.get("generatedMarkers", []))
        for configured in self.config.get("sourceRoots", []):
            root = self.source_root / configured
            if not root.exists():
                continue
            for path in root.rglob("*.cs"):
                relative = path.relative_to(self.source_root).as_posix()
                searchable = f"/{relative}/"
                if any(segment.lower() in searchable.lower() for segment in excludes):
                    continue
                is_test = any(marker.lower() in relative.lower() for marker in test_markers)
                if is_test and not include_tests:
                    continue
                source = path.read_text(encoding="utf-8-sig", errors="replace")
                self.files.append(SourceFile(
                    path=path,
                    relative=relative,
                    source=source,
                    masked=mask_non_code(source),
                    newlines=[match.start() for match in re.finditer("\n", source)],
                    is_test=is_test,
                    is_generated=any(marker.lower() in relative.lower() for marker in generated_markers),
                ))

    def extract_types(self) -> None:
        for file in self.files:
            namespace_match = NAMESPACE_RE.search(file.masked)
            namespace = namespace_match.group(1) if namespace_match else ""
            found = []
            for match in TYPE_RE.finditer(file.masked):
                opening = match.start("open")
                end = matching_brace(file.masked, opening) if match.group("open") == "{" else match.end()
                found.append((match, opening, end))
            for match, opening, end in found:
                name = match.group("name")
                start_line = file.line(match.start())
                end_line = file.line(end)
                parents = [candidate for candidate in found if candidate[1] < opening < candidate[2]]
                parent = min(parents, key=lambda item: item[2] - item[1]) if parents else None
                parent_name = parent[0].group("name") if parent else None
                full_name = f"{namespace}.{name}" if namespace else name
                if parent_name:
                    full_name = f"{namespace}.{parent_name}+{name}" if namespace else f"{parent_name}+{name}"
                kind = match.group("kind").replace(" ", "-")
                bases = [clean_type(item) for item in (match.group("bases") or "").split(",") if clean_type(item)]
                type_id = f"type:{file.relative}:{start_line}:{name}"
                body_start = opening + 1 if match.group("open") == "{" else opening
                body_end = end
                body = file.masked[body_start:body_end]
                source_body = file.source[body_start:body_end]
                responsibilities = []
                searchable = f"{file.relative} {source_body}".lower()
                for responsibility, keywords in RESPONSIBILITY_KEYWORDS.items():
                    if sum(keyword in searchable for keyword in keywords) >= 3:
                        responsibilities.append(responsibility)
                type_model = {
                    "id": type_id, "name": name, "fullName": full_name, "namespace": namespace,
                    "kind": kind, "layer": layer_for(file.relative),
                    "folder": file.relative.rsplit("/", 1)[0] if "/" in file.relative else "(root)",
                    "file": file.relative, "startLine": start_line, "endLine": end_line,
                    "sourceLines": max(1, end_line - start_line + 1),
                    "modifiers": match.group("mods").split(), "baseTypeNames": bases,
                    "isTest": file.is_test, "isGenerated": file.is_generated,
                    "parentTypeName": parent_name, "responsibilities": responsibilities,
                    "patterns": [], "members": [], "methodIds": [], "concreteDependencyIds": [],
                    "methodCount": 0, "memberCount": 0, "fanIn": 0, "fanOut": 0,
                    "inheritanceDepth": 0,
                    "_file": file, "_bodyStart": body_start, "_bodyEnd": body_end,
                }
                self.extract_members_and_methods(type_model, body, source_body)
                self.types.append(type_model)

    def extract_members_and_methods(self, type_model: dict, body: str, source_body: str) -> None:
        depths = direct_depths(body)
        occupied: list[tuple[int, int]] = []
        for match in METHOD_RE.finditer(body):
            if depths[match.start()] != 0 or match.group("name") in CONTROL_WORDS:
                continue
            name = match.group("name")
            return_type = (match.group("return") or type_model["name"]).strip()
            params = split_params(match.group("params"))
            absolute_start = type_model["_bodyStart"] + match.start()
            file: SourceFile = type_model["_file"]
            if match.group("open") == "{":
                local_open = match.start("open")
                local_end = matching_brace(body, local_open)
            elif match.group("open") == "=>":
                semicolon = body.find(";", match.end())
                local_end = semicolon if semicolon >= 0 else match.end()
            else:
                local_end = match.end()
            absolute_end = type_model["_bodyStart"] + local_end
            start_line = file.line(absolute_start)
            end_line = file.line(absolute_end)
            method_id = f"method:{file.relative}:{start_line}:{type_model['name']}.{name}"
            signature = f"{name}({', '.join(item['type'] + ' ' + item['name'] for item in params)})"
            method = {
                "id": method_id, "typeId": type_model["id"], "name": name,
                "signature": signature, "returnType": return_type, "file": file.relative,
                "startLine": start_line, "endLine": end_line,
                "sourceLines": max(1, end_line - start_line + 1),
                "modifiers": match.group("mods").split(), "parameters": params,
                "calls": [], "calledBy": [], "unresolvedCalls": [],
                "_body": body[match.end():local_end],
            }
            self.methods.append(method)
            type_model["methodIds"].append(method_id)
            type_model["members"].append({"name": name, "kind": "method", "type": return_type, "modifiers": method["modifiers"]})
            occupied.append((match.start(), local_end))
        for regex, kind in ((PROPERTY_RE, "property"), (FIELD_RE, "field")):
            for match in regex.finditer(body):
                if depths[match.start()] != 0 or any(start <= match.start() <= end for start, end in occupied):
                    continue
                type_model["members"].append({
                    "name": match.group("name"), "kind": kind,
                    "type": match.group("type").strip(), "modifiers": match.group("mods").split(),
                })
        if type_model["kind"] == "enum":
            for name in re.findall(r"(?m)^\s*([A-Za-z_]\w*)\s*(?:=|,|$)", body):
                type_model["members"].append({"name": name, "kind": "enum-value", "type": "", "modifiers": []})

    def index_models(self) -> None:
        for item in self.types:
            self.types_by_name[item["name"]].append(item)
            self.types_by_id[item["id"]] = item
        for item in self.methods:
            self.methods_by_id[item["id"]] = item

    def resolve_type(self, raw: str, namespace: str) -> dict | None:
        name = clean_type(raw)
        if name in IGNORED_TYPES:
            return None
        candidates = self.types_by_name.get(name, [])
        return next((item for item in candidates if item["namespace"] == namespace), None) or \
            next((item for item in candidates if not item["isTest"]), None) or \
            (candidates[0] if candidates else None)

    def add_relation(self, source: str, target: str, kind: str, evidence: str) -> None:
        key = (source, target, kind)
        if source == target or key in self.relation_keys:
            return
        self.relation_keys.add(key)
        self.relations.append({"sourceId": source, "targetId": target, "kind": kind, "evidence": evidence})

    def extract_dependencies(self) -> None:
        known_names = set(self.types_by_name)
        for item in self.types:
            for base in item["baseTypeNames"]:
                target = self.resolve_type(base, item["namespace"])
                if target:
                    kind = "implements" if target["kind"] == "interface" else "inherits"
                    self.add_relation(item["id"], target["id"], kind, "declared base type")
            file: SourceFile = item["_file"]
            body = file.masked[item["_bodyStart"]:item["_bodyEnd"]]
            mentioned = set(re.findall(r"\b[A-Za-z_]\w*\b", body)) & known_names
            for name in mentioned:
                target = self.resolve_type(name, item["namespace"])
                if target and target["id"] != item["id"]:
                    self.add_relation(item["id"], target["id"], "uses", "type name in declaration body")
            for created in re.findall(r"\bnew\s+([A-Za-z_]\w*)", body):
                target = self.resolve_type(created, item["namespace"])
                if target and target["id"] != item["id"]:
                    item["concreteDependencyIds"].append(target["id"])
                    self.add_relation(item["id"], target["id"], "creates", "object creation")
            item["concreteDependencyIds"] = sorted(set(item["concreteDependencyIds"]))

    def extract_calls(self) -> None:
        methods_by_type_and_name: dict[tuple[str, str], dict] = {}
        for method in self.methods:
            methods_by_type_and_name.setdefault((method["typeId"], method["name"]), method)
        for method in self.methods:
            owner = self.types_by_id[method["typeId"]]
            variables = {param["name"]: clean_type(param["type"]) for param in method["parameters"]}
            for member in owner["members"]:
                if member["kind"] == "field":
                    variables[member["name"]] = clean_type(member["type"])
            for match in LOCAL_RE.finditer(method["_body"]):
                variables[match.group("name")] = clean_type(match.group("type"))
            for call in CALL_RE.finditer(method["_body"]):
                name = call.group("name")
                if name in CONTROL_WORDS:
                    continue
                receiver = call.group("receiver")
                target_type = owner if not receiver or receiver in {"this", "base"} else None
                if receiver and receiver not in {"this", "base"}:
                    target_type = self.resolve_type(variables.get(receiver, receiver), owner["namespace"])
                target_method = methods_by_type_and_name.get((target_type["id"], name)) if target_type else None
                if not target_method:
                    method["unresolvedCalls"].append(name)
                    continue
                if target_method["id"] not in method["calls"]:
                    method["calls"].append(target_method["id"])
                if method["id"] not in target_method["calledBy"]:
                    target_method["calledBy"].append(method["id"])
                if target_type["id"] != owner["id"]:
                    self.add_relation(owner["id"], target_type["id"], "calls", name)
            method["unresolvedCalls"] = sorted(set(method["unresolvedCalls"]))

    def calculate_metrics(self) -> None:
        outgoing: dict[str, set[str]] = defaultdict(set)
        incoming: dict[str, set[str]] = defaultdict(set)
        for relation in self.relations:
            outgoing[relation["sourceId"]].add(relation["targetId"])
            incoming[relation["targetId"]].add(relation["sourceId"])
        for item in self.types:
            item["methodCount"] = len(item["methodIds"])
            item["memberCount"] = len(item["members"])
            item["fanOut"] = len(outgoing[item["id"]])
            item["fanIn"] = len(incoming[item["id"]])
            item["inheritanceDepth"] = self.inheritance_depth(item, set())
            self.add_solid_diagnostics(item)

    def inheritance_depth(self, item: dict, visited: set[str]) -> int:
        if item["id"] in visited:
            return 0
        visited.add(item["id"])
        for base in item["baseTypeNames"]:
            target = self.resolve_type(base, item["namespace"])
            if target and target["kind"] != "interface":
                return 1 + self.inheritance_depth(target, visited)
        return 0

    def diagnostic(self, item: dict, principle: str, severity: str, title: str, evidence: str) -> None:
        self.diagnostics.append({
            "id": f"diag:{item['id']}:{principle}:{title}", "typeId": item["id"],
            "typeName": item["name"], "principle": principle, "severity": severity,
            "title": title, "evidence": evidence, "file": item["file"], "line": item["startLine"],
        })

    def add_solid_diagnostics(self, item: dict) -> None:
        if item["isGenerated"] or item["isTest"]:
            return
        t = self.config.get("solidThresholds", {})
        review_lines, god_lines = t.get("classReviewLines", 300), t.get("godClassLines", 600)
        if item["sourceLines"] >= god_lines:
            self.diagnostic(item, "SRP", "high", "Very large type", f"{item['sourceLines']} lines. 600+ is a strong God class signal.")
        elif item["sourceLines"] >= review_lines:
            self.diagnostic(item, "SRP", "medium", "Large type needs review", f"{item['sourceLines']} lines. Size is a signal, not an automatic split order.")
        if len(item["responsibilities"]) >= 4:
            self.diagnostic(item, "SRP", "high", "Multiple responsibility areas", "Detected " + ", ".join(item["responsibilities"]) + ".")
        elif len(item["responsibilities"]) == 3 and item["sourceLines"] >= 150:
            self.diagnostic(item, "SRP", "medium", "Responsibility boundary is broad", "Detected " + " and ".join(item["responsibilities"]) + ".")
        interface_limit = t.get("interfaceMembers", 10)
        if item["kind"] == "interface" and item["memberCount"] > interface_limit:
            severity = "high" if item["memberCount"] > interface_limit * 2 else "medium"
            self.diagnostic(item, "ISP", severity, "Wide interface", f"{item['memberCount']} members may force unused dependencies.")
        if item["fanOut"] > t.get("fanOut", 12):
            self.diagnostic(item, "DIP/Coupling", "medium", "High outgoing coupling", f"Depends on {item['fanOut']} project types.")
        if item["fanIn"] > t.get("fanIn", 20):
            self.diagnostic(item, "Stability", "medium", "High incoming coupling", f"Used by {item['fanIn']} project types; changes have broad impact.")
        if len(item["concreteDependencyIds"]) > t.get("concreteDependencies", 8):
            self.diagnostic(item, "DIP", "medium", "Many concrete constructions", f"Creates {len(item['concreteDependencyIds'])} project types directly.")
        allowed_session = item["name"].endswith("Session") and item["inheritanceDepth"] <= 2
        if item["inheritanceDepth"] > 1 and not allowed_session:
            severity = "high" if item["inheritanceDepth"] > 2 else "medium"
            self.diagnostic(item, "Composition", severity, "Deep inheritance", f"Inheritance depth is {item['inheritanceDepth']}; project convention prefers <= 1.")
        mutable_static = [member for member in item["members"] if member["kind"] == "field" and "static" in member["modifiers"] and "readonly" not in member["modifiers"] and "const" not in member["modifiers"]]
        if mutable_static:
            self.diagnostic(item, "State", "medium", "Mutable static state", f"Contains {len(mutable_static)} mutable static field(s).")

    def detect_cycles(self) -> None:
        graph: dict[str, set[str]] = defaultdict(set)
        for relation in self.relations:
            if relation["kind"] in {"uses", "creates", "calls"}:
                graph[relation["sourceId"]].add(relation["targetId"])
        index = 0
        stack: list[str] = []
        indices: dict[str, int] = {}
        low: dict[str, int] = {}
        on_stack: set[str] = set()

        def visit(node: str) -> None:
            nonlocal index
            indices[node] = low[node] = index
            index += 1
            stack.append(node)
            on_stack.add(node)
            for target in graph[node]:
                if target not in indices:
                    visit(target)
                    low[node] = min(low[node], low[target])
                elif target in on_stack:
                    low[node] = min(low[node], indices[target])
            if low[node] != indices[node]:
                return
            component = []
            while stack:
                current = stack.pop()
                on_stack.remove(current)
                component.append(current)
                if current == node:
                    break
            if len(component) > 1:
                names = sorted(self.types_by_id[item]["name"] for item in component if item in self.types_by_id)
                for type_id in component:
                    item = self.types_by_id.get(type_id)
                    if item and not item["isGenerated"]:
                        self.diagnostic(item, "Dependency", "medium", "Cyclic dependency", "Cycle group: " + " -> ".join(names))

        for item in self.types:
            if item["id"] not in indices:
                visit(item["id"])

    def detect_patterns(self) -> None:
        for item in self.types:
            names = " ".join(member["name"] for member in item["members"])
            if item["name"].endswith("Handler") or any(base.endswith("Handler") for base in item["baseTypeNames"]): item["patterns"].append("Command/Handler")
            if item["name"].endswith("Factory") or "Create" in names: item["patterns"].append("Factory")
            if item["name"].endswith("System"): item["patterns"].append("Component System")
            if item["kind"] == "enum" and item["name"].endswith("State"): item["patterns"].append("State")
            if item["name"].endswith("Strategy") or any(base.endswith("Strategy") for base in item["baseTypeNames"]): item["patterns"].append("Strategy")
            if "EnqueueJob" in names and "Tick" in names: item["patterns"].append("Actor/Update Method")
            if item["name"].endswith("Registry") or item["name"].endswith("Table"): item["patterns"].append("Registry/Flyweight")
            if any(member["name"] == "Instance" and "static" in member["modifiers"] for member in item["members"]): item["patterns"].append("Singleton/Service Locator")

    def sort_models(self) -> None:
        for item in self.types:
            for key in list(item):
                if key.startswith("_"):
                    del item[key]
        for item in self.methods:
            for key in list(item):
                if key.startswith("_"):
                    del item[key]
            item["calls"].sort()
            item["calledBy"].sort()
        rank = {"high": 2, "medium": 1, "low": 0}
        self.types.sort(key=lambda item: item["fullName"])
        self.methods.sort(key=lambda item: (item["typeId"], item["startLine"]))
        self.relations.sort(key=lambda item: (item["sourceId"], item["targetId"], item["kind"]))
        self.diagnostics.sort(key=lambda item: (-rank.get(item["severity"], 0), item["typeName"], item["title"]))


def ensure_output_outside_source(source: Path, output: Path) -> None:
    if output == source or source in output.parents:
        raise ValueError(f"Output must be outside the read-only source directory: {output}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    config = json.loads(Path(args.config).read_text(encoding="utf-8-sig"))
    if not source.is_dir():
        raise SystemExit(f"Source directory does not exist: {source}")
    try:
        ensure_output_outside_source(source, output)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    model = Analyzer(source, config).run()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text("window.ARCHITECTURE_DATA = " + json.dumps(model, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    temporary.replace(output)
    summary = model["summary"]
    print(f"Analyzed {summary['files']} files, {summary['types']} types, {summary['methods']} methods, {summary['relations']} relations, {summary['diagnostics']} diagnostics.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
