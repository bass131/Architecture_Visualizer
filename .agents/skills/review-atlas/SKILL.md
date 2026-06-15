---
name: review-atlas
description: Review changes in the DawnHolder Architecture Atlas repository against its architecture, UI, source-boundary, testing, and deterministic-verification rules. Use for code review, pre-commit audits, regression checks, or validation of harness and documentation changes.
---

# Review Atlas

1. Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md`, `docs/SOURCE_BOUNDARY.md`, and `docs/UI_GUIDE.md` when UI is affected.
2. Inspect the current diff and identify the behavioral surface changed.
3. Lead with concrete findings ordered by severity. Include local file and line references.
4. Check source-repository isolation, atomic generated-data replacement, offline operation, schema compatibility, and evidence quality.
5. Confirm behavioral changes include focused tests or reproducible fixtures.
6. Run `verify.ps1` for UI, documentation, or harness review. Run `verify.ps1 -Refresh` when analyzer, policy, or data semantics changed.
7. Distinguish verified defects from residual risk. If no issues are found, state that clearly and name any untested surface.

## Measurement Ownership

- Review Atlas-owned structural output for reproducibility and evidence quality: type/method models, relations, call estimates, fan-in/out, structure metrics, category, and severity.
- Do not introduce ad-hoc brace, casing, formatting, or single-statement counts into Atlas findings. Source `.editorconfig` plus Roslyn/StyleCop owns those measurements.
- Label any unverified style observation `source Roslyn validation heuristic` and keep it separate from Atlas diagnostics.
- Responsibility-header and history/Phase-comment observations may be informational documentation debt only; they are not style compliance scores.

Do not edit files while performing a review unless the user explicitly asks to address the findings.
