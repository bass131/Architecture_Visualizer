---
name: develop-atlas
description: Implement scoped changes to the DawnHolder Architecture Atlas. Use when Codex needs to add, fix, or refactor analyzer rules, generated-data contracts, the file-based UI, project documentation, verification, or harness configuration in this repository.
---

# Develop Atlas

1. Read `AGENTS.md` and only the task-relevant files from `docs/` and `config/analysis-config.json`.
2. Classify the change as analyzer, data contract, UI, documentation, or harness work.
3. Inspect `C:\Dev\ClaudeDev` only when source evidence is required. Keep it read-only and ignore its agent workflows.
4. For substantial work, maintain a concise plan with one active step. Keep each step within one responsibility.
5. Add or update a deterministic test or fixture before or alongside behavioral changes. Documentation-only edits are exempt.
6. Implement with existing project patterns. Keep `_index.html` as the user entry point and preserve offline `file://` operation.
7. Run the verification command required by `AGENTS.md`. Use `verify.ps1 -Refresh` for analyzer, policy, or data-contract changes.
8. Review the diff for scope growth, source writes, unsupported diagnostic claims, and missing tests before reporting completion.
9. Keep normal implementation on the project default model. Count only executable or acceptance-criterion failures; after one failure revise the approach, and after two failures follow the model-escalation policy in `docs/CODEX_WORKFLOW.md`.

Do not add unattended branch creation, automatic commits, or pushes. Git publication remains an explicit user action.
