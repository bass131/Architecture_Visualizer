---
name: refresh-architecture
description: Regenerate and verify the DawnHolder architecture atlas from the read-only C# source repository. Use when the user asks to refresh, rebuild, regenerate, update, or validate architecture-data.js, or after analyzer, diagnostic-policy, source-model, relation, call-graph, or data-contract changes.
---

# Refresh Architecture

1. Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SOURCE_BOUNDARY.md`, and `config/analysis-config.json`.
2. Keep `C:\Dev\ClaudeDev` read-only and separate from this repository. Confirm the requested source path if it differs.
3. Capture current summary counts from `data/architecture-data.js` when a before/after comparison matters.
4. Run `verify.ps1 -Refresh` from the project root. This performs WSL Python syntax checking, analysis, data-contract validation, and JavaScript syntax checking when Node is available.
5. If the command fails, diagnose the first failing gate. Fix only harness files, then retry up to five times.
6. Confirm that `data/architecture-data.js` exists, uses schema `1.0`, and contains nonzero type and method counts.
7. Report files, types, methods, relations, diagnostics, high/medium severity counts, and notable changes.

Never replace the generated output manually, modify the source repository, or execute its agent hooks and write workflows. Preserve the analyzer's temporary-file replacement behavior.
