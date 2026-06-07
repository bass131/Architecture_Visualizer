#!/usr/bin/env python3
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
prefix = "window.ARCHITECTURE_DATA = "
assert text.startswith(prefix) and text.endswith(";\n"), "Invalid JavaScript data wrapper"
data = json.loads(text[len(prefix):-2])
assert data["schemaVersion"] == "1.0", "Unsupported schema"
assert data["summary"]["types"] > 0, "No types"
assert data["summary"]["methods"] > 0, "No methods"
type_ids = {item["id"] for item in data["types"]}
method_ids = {item["id"] for item in data["methods"]}
assert len(type_ids) == len(data["types"]), "Duplicate type ids"
assert len(method_ids) == len(data["methods"]), "Duplicate method ids"
for relation in data["relations"]:
    assert relation["sourceId"] in type_ids, "Unknown relation source"
    assert relation["targetId"] in type_ids, "Unknown relation target"
for method in data["methods"]:
    assert method["typeId"] in type_ids, "Unknown method owner"
    assert all(target in method_ids for target in method["calls"]), "Unknown called method"
    assert all(source in method_ids for source in method["calledBy"]), "Unknown caller"
print(f"Verified {len(type_ids)} types, {len(method_ids)} methods, {len(data['relations'])} relations.")
