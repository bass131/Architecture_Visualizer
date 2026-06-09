---
name: refresh-architecture
description: Synchronize the DawnHolder Architecture Atlas with the read-only ClaudeDev C# repository, regenerate and verify architecture-data.js, assess whether curated diagrams are stale, and confirm the file-based Visualizer consumes the refreshed model. Use when ClaudeDev changed, when the user asks to refresh, rebuild, regenerate, synchronize, update, or validate the atlas, or after analyzer, diagnostic-policy, relation, call-graph, source-model, or data-contract changes.
---

# Refresh Architecture

1. Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SOURCE_BOUNDARY.md`, `config/analysis-config.json`, `_index.html`, and only the relevant portions of `assets/app.js`.
2. Keep `C:\Dev\ClaudeDev` read-only and separate from this repository. Confirm the requested source path only when it differs from the default. Never run source-project hooks, generators, formatters, migrations, or write workflows.
3. Before refresh, record the existing dataset hash and summary counts. When useful, also capture type IDs, method IDs, relation triples, and diagnostic IDs for deterministic before/after comparison.
4. Run `verify.ps1 -Refresh` from the Atlas root. This is the required regeneration path; do not invoke the analyzer manually or replace `data/architecture-data.js` by hand.
5. On failure, diagnose the first failing gate and change only Atlas-owned files. Retry at most five times. Confirm the previous generated dataset was not replaced when analysis failed.

## Visualizer Synchronization

6. Confirm `_index.html` remains the only entry point, loads `data/architecture-data.js` before `assets/app.js`, and has no server, CDN, or network requirement.
7. Confirm the refreshed dataset uses schema `1.0`, has nonzero type and method counts, and passes relation, call-graph, layer, source-scope, and test-exclusion checks.
8. Check the data-driven surfaces against the refreshed model:
   - project tree and search: types, folders, generated-code visibility;
   - overview: project and diagnostic summaries;
   - class map: selected type and direct incoming/outgoing relations;
   - explorer: members, local relations, and diagnostic context;
   - diagnostics: severity, principle, evidence, and source links.
9. Treat these `assets/app.js` models as curated source-backed views, not automatic projections of `architecture-data.js`:
   - `createFlowScenarios()` for **전체 흐름**;
   - `createSystemArchitectureDiagram()` and `formatArchitectureSource()` for **전체 구조도**;
   - `sourceUmlModel()` for **소스 UML**.
10. Compare notable ClaudeDev changes with those curated views. Update Atlas-owned models and their deterministic harness assertions only when responsibilities, boundaries, protocols, generation paths, or named source evidence changed. Do not edit curated diagrams merely because counts changed.
11. If curated UI files changed, run `verify.ps1` after the edit. Run another `verify.ps1 -Refresh` only when analyzer, policy, or generated-data semantics also changed.

## Completion Report

12. Report before/after values for files, types, methods, relations, diagnostics, high severity, and medium severity. List notable added or removed types, relation/call changes, and diagnostic changes when present.
13. State which Visualizer surfaces were checked, whether any curated diagram required an update, and that `_index.html` still works through `file://`.

Never replace the generated output manually, modify the source repository, or execute its agent hooks and write workflows. Preserve the analyzer's temporary-file replacement behavior.
