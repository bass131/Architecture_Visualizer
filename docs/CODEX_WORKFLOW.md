# Codex Workflow

## Harness Layers

This repository adapts the four-layer harness model to Codex without copying tool-specific automation.

| Harness concern | Codex implementation |
| --- | --- |
| Product and design context | `docs/PRD.md`, `ARCHITECTURE.md`, `ADR.md`, `UI_GUIDE.md`, `SOURCE_BOUNDARY.md` |
| Project constitution | `AGENTS.md` |
| One-stop development and review | `/skills` selector or direct `$develop-atlas`, `$review-atlas`, `$refresh-architecture`, `$review-architecture` invocation |
| Automatic validation | `verify.ps1`, analyzer tests, data-contract checks, `.githooks/pre-commit` |

## Work Loop

1. Load only the relevant project context.
2. Discuss decisions only when workspace evidence cannot resolve them safely.
3. Break substantial work into responsibility-sized steps with executable acceptance criteria.
4. Implement and test in the current Codex session so context and user control remain visible.
5. Run the deterministic gate required by `AGENTS.md`.
6. Review the diff against architecture, source boundary, UI rules, and test coverage.

Codex plans replace persistent `phases/` files for normal work. Create durable phase documents only when the user explicitly requests a multi-session program of work.

## Reasoning Effort Policy

| Work type | Effort | Execution |
| --- | --- | --- |
| Simple lookup, status, refresh, syntax/schema check | Current `medium` session | Run the deterministic command directly; do not delegate |
| Normal implementation, debugging, and routing | `medium` | Main session and `$develop-atlas` workflow |
| Verification with failure interpretation | `medium` | Main session or project `verifier` when independent assessment is justified |
| Architecture, regression, diagnostic, or evidence review | `high` | Project `reviewer` or `$review-atlas` workflow |

Effort reflects judgment complexity, not elapsed time or file count. A long deterministic refresh remains direct execution; a short but ambiguous architecture decision may justify `high` review.

## Context Economy

- Read focused context instead of loading every project document.
- Batch independent file reads and searches.
- Do not repeat a full refresh when no analyzer, policy, source snapshot, or data-contract input changed.
- Use scripts to establish counts, schemas, syntax, and reproducibility before asking a model to interpret them.
- Delegate only when an independent opinion adds value; delegation duplicates context and token cost.

## Slash Commands

Codex has built-in slash commands for session control. Type `/` to browse them. Common commands for this repository include `/skills`, `/plan`, `/diff`, `/review`, `/status`, `/compact`, `/permissions`, `/agent`, and `/hooks`.

Repository-defined workflows are skills rather than arbitrary new slash-command names. Use `/skills` and choose a project skill, or mention it directly with `$skill-name`. This is the Codex equivalent of selecting a reusable project command while preserving Codex's native permission and session model.

## Deliberate Differences

- Do not invoke another unattended coding agent from a project script.
- Do not bypass the Codex permission model.
- Do not create branches, commits, or pushes automatically.
- Do not duplicate dangerous-command guards already enforced by the Codex runtime. Keep project-specific safety rules in `AGENTS.md` and executable repository invariants in verification scripts.
- Use the Git pre-commit hook as a final local gate, not as a substitute for running verification during implementation.

## Acceptance Criteria

- Documentation or harness changes: `verify.ps1`; run `codex doctor` when `.codex/` changes.
- UI changes: `verify.ps1` plus manual inspection when behavior or layout changes.
- Analyzer, policy, or data-contract changes: `verify.ps1 -Refresh`.
- Review work: findings first, with file references and remaining test risk.
