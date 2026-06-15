---
name: review-architecture
description: Review DawnHolder architecture diagnostics against the real C# source without modifying it. Use when the user asks to inspect SOLID warnings, coupling or cycle signals, validate analyzer findings, identify false positives, or perform a read-only architecture review.
---

# Review Architecture

1. Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SOURCE_BOUNDARY.md`, `docs/ADR.md`, and relevant thresholds in `config/analysis-config.json`.
2. Start with high-severity entries in `data/architecture-data.js`, then inspect referenced files under `C:\Dev\ClaudeDev` read-only.
3. Evaluate SRP by independent reasons to change, not line count alone.
4. Evaluate ISP and DIP using actual callers, implementations, construction sites, and project conventions.
5. Treat call relations as static estimates. Account for reflection, delegates, events, dynamic dispatch, and dependency-injection bindings.
6. Distinguish intentional collaboration inside an actor or container from harmful cyclic dependencies.
7. Classify each result as confirmed issue, review recommendation, or static-analysis false positive.
8. Lead with findings ordered by severity and include source file and line references.

## Measurement Ownership

- Atlas owns reproducible structural evidence: types, methods, relations, call estimates, fan-in/out, delegation and decision density, approximate field-sharing, and container signals.
- Do not present brace, casing, formatting, or single-statement style counts as Atlas measurements. The source repository's `.editorconfig` and Roslyn/StyleCop results are authoritative for those rules.
- If a style concern must be mentioned without source analyzer output, label it `source Roslyn validation heuristic`; do not attach an authoritative count.
- Treat missing responsibility headers and history/Phase comments only as informational documentation-debt observations, not style compliance metrics.

Do not refactor the source repository or execute its agent workflows. If the user later asks for a source fix, treat that as a separate project task requiring explicit source-write permission.
