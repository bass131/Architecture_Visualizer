#!/usr/bin/env python3
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
prefix = "window.ARCHITECTURE_DATA = "
assert text.startswith(prefix) and text.endswith(";\n"), "Invalid JavaScript data wrapper"
data = json.loads(text[len(prefix):-2])
assert data["schemaVersion"] == "1.1", "Unsupported schema"
assert data["summary"]["types"] > 0, "No types"
assert data["summary"]["methods"] > 0, "No methods"
allowed_prefixes = (
    "02_Server/",
    "03_Client/Assets/Scripts/",
    "04_ClientNet/",
    "98_Shared/",
    "99_Tools/PacketGenerator/",
)
allowed_layers = {"Server", "Client", "ClientNet", "Shared", "Tool"}
type_ids = {item["id"] for item in data["types"]}
method_ids = {item["id"] for item in data["methods"]}
allowed_categories = {"issue", "recommendation", "informational"}
assert len(type_ids) == len(data["types"]), "Duplicate type ids"
assert len(method_ids) == len(data["methods"]), "Duplicate method ids"
assert {item["name"] for item in data["projects"]} == allowed_layers, "Unexpected architecture layer"
for item in data["types"]:
    assert item["file"].startswith(allowed_prefixes), f"Type outside architecture scope: {item['file']}"
    assert not item["isTest"], f"Test type included in architecture scope: {item['file']}"
    structure = item["structureMetrics"]
    for key in ("delegationDensity", "decisionDensity", "decisionHeavyMethodRatio", "stateCentrality", "collaboratorFanOutRatio", "fieldSharingCohesion"):
        assert 0 <= structure[key] <= 1, f"Invalid {key}: {item['id']}"
    assert structure["fanOutKind"] in {"collaborator-heavy", "domain-spanning"}, f"Invalid fanOutKind: {item['id']}"
for relation in data["relations"]:
    assert relation["sourceId"] in type_ids, "Unknown relation source"
    assert relation["targetId"] in type_ids, "Unknown relation target"
for method in data["methods"]:
    assert method["file"].startswith(allowed_prefixes), f"Method outside architecture scope: {method['file']}"
    assert method["typeId"] in type_ids, "Unknown method owner"
    assert all(target in method_ids for target in method["calls"]), "Unknown called method"
    assert all(source in method_ids for source in method["calledBy"]), "Unknown caller"
for diagnostic in data["diagnostics"]:
    assert diagnostic["category"] in allowed_categories, f"Unknown diagnostic category: {diagnostic.get('category')}"
for category, summary_key in (
    ("issue", "issueCount"),
    ("recommendation", "recommendationCount"),
    ("informational", "informationalCount"),
):
    assert data["summary"][summary_key] == sum(item["category"] == category for item in data["diagnostics"]), f"Incorrect {summary_key}"
print(f"Verified {len(type_ids)} types, {len(method_ids)} methods, {len(data['relations'])} relations.")
