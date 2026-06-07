# DawnHolder Architecture Atlas

## Mission

Maintain this repository as an independent Codex project that analyzes `C:\Dev\ClaudeDev` as read-only input and presents the resulting static architecture atlas through `_index.html`.

## Non-Negotiable Rules

1. Treat `C:\Dev\ClaudeDev` as read-only. Never edit, generate, move, or delete files there.
2. Keep this repository's Git history, generated output, tools, and agent configuration separate from the source repository.
3. Do not inherit or execute source-project agent hooks, state, commands, or write workflows. Source documentation is domain evidence only.
4. Keep `_index.html` as the only user entry point. New user-facing behavior must be discoverable there.
5. Present SOLID results as evidence-backed review signals, never automatic pass/fail judgments.
6. Keep generated data reproducible with one `refresh.ps1` invocation.
7. Preserve `file://` operation without an external server, CDN, or network dependency.
8. Do not replace a valid generated dataset when analysis fails. Keep atomic output replacement intact.
9. Use WSL Python for analysis when Windows Application Control blocks new Windows executables.
10. Do not report completion until the relevant deterministic verification passes.

## Read First

Load only the context needed for the task:

- Product behavior: `docs/PRD.md`
- Component boundaries and data flow: `docs/ARCHITECTURE.md`
- Design decisions and tradeoffs: `docs/ADR.md`
- Source-repository isolation: `docs/SOURCE_BOUNDARY.md`
- Executable analysis policy: `config/analysis-config.json`
- Harness roles and gates: `HARNESS.md`

When interpreting the source project, consult its architecture records and relevant conventions as domain evidence. Source-project agent orchestration, hooks, state, and write instructions do not apply here.

## Task Routing

- Analyzer or diagnostic rule: edit `tools/analyze.py` and, when appropriate, `config/analysis-config.json`.
- Data contract: coordinate `tools/analyze.py`, `tools/verify_data.py`, and consumers in `assets/app.js`.
- UI or navigation: edit `_index.html`, `assets/app.js`, or `assets/styles.css`; do not move source interpretation into the browser.
- Documentation or harness behavior: edit `AGENTS.md`, `HARNESS.md`, `README.md`, `docs/`, `.agents/skills/`, or `.codex/`.

Keep each change within one responsibility unless the contract genuinely crosses boundaries.

## Harness Loop

`classify request -> load focused context -> inspect source read-only -> implement -> refresh when data semantics changed -> verify -> review failures and retry`

Retry a failing implementation at most five times. Stop and report the concrete blocker if the same external condition prevents progress.

## Verification Matrix

- Documentation or harness-only changes: validate skill and config syntax; run `codex doctor` when Codex configuration changed.
- UI-only changes that do not alter generated data: run `verify.ps1`.
- Analyzer, policy, or data-contract changes: run `verify.ps1 -Refresh`.
- Before reporting regenerated output, include files, types, methods, relations, diagnostics, and notable count changes.

## Codex Roles

- Main agent: route work, make decisions, and perform scoped implementation.
- Built-in `explorer`: optional read-heavy context gathering for large investigations.
- Project `reviewer`: read-only validation of diagnostics, regressions, and over-warning.
- Project `verifier`: read-only execution and assessment of deterministic gates.

Spawn subagents only when the user asks for parallel agents or the task is substantial enough to justify an explicit delegated review. Avoid parallel write-heavy agents.

## Reusable Skills

- `$refresh-architecture`: regenerate the atlas and verify the complete data pipeline.
- `$review-architecture`: review high-priority diagnostics against the source without refactoring it.
