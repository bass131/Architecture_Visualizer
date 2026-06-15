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
- Visual language and interaction rules: `docs/UI_GUIDE.md`
- Source-repository isolation: `docs/SOURCE_BOUNDARY.md`
- Codex workflow mapping: `docs/CODEX_WORKFLOW.md`
- Executable analysis policy: `config/analysis-config.json`
- Harness roles and gates: `HARNESS.md`

When interpreting the source project, consult its architecture records and relevant conventions as domain evidence. Source-project agent orchestration, hooks, state, and write instructions do not apply here.

## Task Routing

- Analyzer or diagnostic rule: edit `tools/analyze.py` and, when appropriate, `config/analysis-config.json`.
- Data contract: coordinate `tools/analyze.py`, `tools/verify_data.py`, and consumers in `assets/app.js`.
- UI or navigation: edit `_index.html`, `assets/app.js`, or `assets/styles.css`; do not move source interpretation into the browser.
- Documentation or harness behavior: edit `AGENTS.md`, `HARNESS.md`, `README.md`, `docs/`, `.agents/skills/`, or `.codex/`.

Keep each change within one responsibility unless the contract genuinely crosses boundaries.

## Development Rules

- Add or update a deterministic test or reproducible fixture before or alongside behavioral analyzer and UI changes. Documentation-only changes are exempt.
- Keep acceptance criteria executable. Prefer repository commands over prose-only claims.
- Use conventional commit messages when the user requests a commit.
- Do not create branches, commits, pushes, or unattended agent runs unless the user explicitly requests them.

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

## Reasoning Effort

- Main session and implementation: `gpt-5.4-mini` with `medium` effort. Use this project default for routing, coding, debugging, and ordinary design decisions.
- Focused exploration: `gpt-5.4-mini` with `low` effort through `explorer` when delegation is justified.
- Deterministic verification: `gpt-5.4-mini` with `low` effort through `verifier`; executable scripts establish the facts and the agent only interprets the selected gate.
- Architecture and regression review: `gpt-5.5` with `high` effort through `reviewer`, because source-backed evidence, false positives, and missing-test risk require deeper judgment.
- Implementation escalation: `gpt-5.5` with `medium` effort through `escalation-worker` only after two evidence-backed failures of the same bounded task, or when the user explicitly requests a demanding GPT-5.5 worker.
- Simple reads, status checks, refresh commands, and exact-format validation: run directly in the main session without spawning another agent or increasing effort.

Do not raise the model or effort merely because a task is long. A failure counts toward escalation only when a build, test, deterministic gate, or explicit acceptance criterion fails. Tooling or permission failures do not count. After the first failure, diagnose and retry once with a materially revised approach. After the second failure, use `escalation-worker` only when subagent use is explicitly requested or authorized for the task; otherwise report the evidence and recommend switching the current session with `/model`. Escalate to `reviewer` only when the work requires independent judgment about correctness, architecture, evidence, or regression risk.

## Context Economy

- Load only task-relevant documents and source files; do not reread the whole harness by default.
- Prefer one targeted verification during iteration and one final required gate. Avoid repeated full refreshes unless source or generated-data semantics changed.
- Use deterministic scripts for facts they can establish; reserve model reasoning for interpretation and decisions.
- Do not spawn a subagent for work the main session can verify directly.

## Reusable Skills

- `$refresh-architecture`: regenerate the atlas and verify the complete data pipeline.
- `$review-architecture`: review high-priority diagnostics against the source without refactoring it.
- `$develop-atlas`: implement a scoped repository change through the Codex harness loop.
- `$review-atlas`: review repository changes against architecture, UI, tests, and verification evidence.
