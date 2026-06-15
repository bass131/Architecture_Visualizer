# Codex Agent Harness

## 1. Machine-Readable Context

- `AGENTS.md`: immutable rules, routing, and verification loaded by Codex
- `docs/PRD.md`: what the project builds
- `docs/ARCHITECTURE.md`: component boundaries and data flow
- `docs/ADR.md`: reasons and tradeoffs behind decisions
- `docs/UI_GUIDE.md`: visual language, interaction, and anti-patterns
- `docs/SOURCE_BOUNDARY.md`: executable and procedural boundary around the source repository
- `docs/CODEX_WORKFLOW.md`: mapping from generic harness layers to Codex features
- `config/analysis-config.json`: executable analysis policy
- `.agents/skills/`: reusable refresh and review workflows
- `.codex/config.toml`: project TUI and subagent policy

## 2. Deterministic Gates

1. WSL Python syntax and analyzer unit tests
2. Harness structure, offline-entry-point, and legacy-path validation
3. Analysis of the real DawnHolder source through `refresh.ps1` or `refresh.sh`
4. Generated-data wrapper, schema, identifier, relation, and call-reference validation
5. JavaScript syntax check when Node is available
6. Nonzero file, type, and method counts

## 3. Tool Boundaries

- Source repository: external read-only input
- This project: analyzer, UI, generated data, Codex configuration, and documentation may be written
- Repository isolation: do not reuse source-project agent state, hooks, commands, Git metadata, or generated output
- Network: not required for normal analysis and verification
- Destructive commands: prohibited
- WAC response: use interpreted tools in WSL Ubuntu instead of repeatedly attempting blocked Windows executables

## 4. Feedback Loop

Do not explain away omissions or false positives. Add a reproducible sample or rule, fix the analyzer or policy, regenerate the complete dataset, and rerun deterministic verification.

## 5. Codex Roles

- Main agent / Router and Worker (`gpt-5.4-mini`, `medium`): classify and implement one coherent responsibility
- Project `explorer` (`gpt-5.4-mini`, `low`): perform focused read-heavy investigation when delegation is justified
- Project `verifier` (`gpt-5.4-mini`, `low`): read-only execution and evaluation of deterministic gates
- Project `reviewer` (`gpt-5.5`, `high`): read-only review of reproducibility, correctness, regressions, and over-warning
- Project `escalation-worker` (`gpt-5.5`, `medium`): bounded implementation retry after two evidence-backed failures or explicit user request

Codex does not spawn subagents automatically. Use them only when the user explicitly requests parallel agents or a substantial change merits an independent delegated review. Keep write-heavy work with the main agent. Source-project agent definitions are not part of this harness.

Simple reads, status checks, refreshes, and deterministic syntax or schema checks stay in the main session. They do not justify a subagent or a model increase. See `docs/CODEX_WORKFLOW.md` for escalation and context-economy rules.

## 6. Codex Workflows

- `/skills`: browse and invoke repository skills from the Codex slash-command menu
- `$refresh-architecture`: WSL analysis, regeneration, contract validation, and JavaScript validation
- `$review-architecture`: source-backed read-only review beginning with high-severity diagnostics
- `$develop-atlas`: scoped implementation with focused context, tests, and verification
- `$review-atlas`: repository conformance and regression review

The versioned `.githooks/pre-commit` script runs the appropriate deterministic gate. It refreshes generated data when analyzer semantics are staged and rejects the commit if the refreshed dataset still needs staging.

This directory is an independent Git repository. Start Codex CLI from `C:\Dev\DawnHolder_Architecture`; launching from a child directory can change discovery of root `AGENTS.md`, `.codex`, and `.agents/skills`.
