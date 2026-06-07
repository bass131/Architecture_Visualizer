#!/usr/bin/env python3
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent

REQUIRED_FILES = (
    "AGENTS.md",
    "HARNESS.md",
    "docs/PRD.md",
    "docs/ARCHITECTURE.md",
    "docs/ADR.md",
    "docs/UI_GUIDE.md",
    "docs/SOURCE_BOUNDARY.md",
    "docs/CODEX_WORKFLOW.md",
    ".agents/skills/develop-atlas/SKILL.md",
    ".agents/skills/review-atlas/SKILL.md",
    ".agents/skills/refresh-architecture/SKILL.md",
    ".agents/skills/review-architecture/SKILL.md",
)


def main() -> int:
    missing = [relative for relative in REQUIRED_FILES if not (ROOT / relative).is_file()]
    assert not missing, f"Missing harness files: {', '.join(missing)}"
    assert not (ROOT / "CLAUDE.md").exists(), "Legacy CLAUDE.md must not govern this repository"
    assert not (ROOT / ".claude").exists(), "Legacy .claude directory must not govern this repository"

    for relative in REQUIRED_FILES:
        text = (ROOT / relative).read_text(encoding="utf-8")
        assert "[TODO" not in text, f"Unresolved skill or document placeholder: {relative}"

    index = (ROOT / "_index.html").read_text(encoding="utf-8")
    assert 'src="data/architecture-data.js"' in index, "Generated dataset is not loaded by _index.html"
    assert 'src="assets/app.js"' in index, "Application script is not loaded by _index.html"
    assert "http://" not in index and "https://" not in index, "_index.html must not depend on a network resource"

    print(f"Verified harness structure with {len(REQUIRED_FILES)} required files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
