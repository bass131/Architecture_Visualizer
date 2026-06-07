# Codex Agent Harness

## 1. Machine-Readable Context

- `AGENTS.md`: immutable rules, routing, and verification loaded by Codex
- `docs/PRD.md`: what the project builds
- `docs/ARCHITECTURE.md`: component boundaries and data flow
- `docs/ADR.md`: reasons and tradeoffs behind decisions
- `docs/SOURCE_BOUNDARY.md`: executable and procedural boundary around the source repository
- `config/analysis-config.json`: executable analysis policy
- `.agents/skills/`: reusable refresh and review workflows
- `.codex/config.toml`: project TUI and subagent policy

## 2. Deterministic Gates

1. WSL Python syntax check
2. Analysis of the real DawnHolder source through `refresh.ps1` or `refresh.sh`
3. Generated-data wrapper, schema, identifier, relation, and call-reference validation
4. JavaScript syntax check when Node is available
5. Nonzero file, type, and method counts

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

- Main agent / Router: classify work as UI, analyzer, data contract, or harness
- Built-in `explorer` / Context Manager: perform focused read-heavy investigation when delegation is justified
- Main agent / Worker: implement one coherent responsibility
- Project `reviewer`: read-only review of reproducibility, correctness, regressions, and over-warning
- Project `verifier`: read-only execution and evaluation of deterministic gates

Codex does not spawn subagents automatically. Use them only when the user explicitly requests parallel agents or a substantial change merits an independent delegated review. Keep write-heavy work with the main agent. Source-project agent definitions are not part of this harness.

## 6. Codex Workflows

- `$refresh-architecture`: WSL analysis, regeneration, contract validation, and JavaScript validation
- `$review-architecture`: source-backed read-only review beginning with high-severity diagnostics

This directory is an independent Git repository. Start Codex CLI from `C:\Dev\DawnHolder_Architecture`; launching from a child directory can change discovery of root `AGENTS.md`, `.codex`, and `.agents/skills`.
