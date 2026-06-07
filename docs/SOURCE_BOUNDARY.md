# Source Boundary

## Repository Roles

- `C:\Dev\DawnHolder_Architecture`: independent Codex-managed architecture analysis project.
- `C:\Dev\ClaudeDev`: external C# source project analyzed as read-only input.

The repositories do not share Git history, generated files, agent state, hooks, or configuration.

## Allowed Source Access

The analyzer may:

- enumerate configured source directories;
- read C# source and project documentation;
- record source-relative paths and static-analysis evidence in the generated dataset.

The analyzer and Codex agents must not:

- create, edit, move, or delete files under the source root;
- run source-project formatting, generation, migration, or cleanup commands;
- inherit source-project agent hooks, state, commands, or write workflows;
- place temporary or generated atlas files under the source root.

Source architecture records and conventions may be consulted only as domain evidence. Source-project agent orchestration rules do not govern this repository.

## Output Ownership

All generated output belongs to this repository. `refresh.ps1` and `refresh.sh` pass an output path under `data/`, and `tools/analyze.py` rejects any output path located inside the analyzed source tree. The final dataset is replaced atomically only after analysis succeeds.

`data/architecture-data.js` is committed intentionally because `_index.html` must work directly through `file://` without requiring a refresh or local server.
