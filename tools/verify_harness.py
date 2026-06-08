#!/usr/bin/env python3
import json
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
    assert 'data-view="flow"' in index, "End-to-end architecture flow is not discoverable from _index.html"
    assert 'data-view="architecture"' in index, "High-level architecture overview is not discoverable from _index.html"
    assert 'data-view="classes"' in index, "Area class diagrams are not discoverable from _index.html"
    assert 'id="sidebar-toggle"' in index and 'id="context-toggle"' in index, "Side panel visibility controls are missing"
    assert "http://" not in index and "https://" not in index, "_index.html must not depend on a network resource"

    app = (ROOT / "assets/app.js").read_text(encoding="utf-8")
    styles = (ROOT / "assets/styles.css").read_text(encoding="utf-8")
    analysis_config = json.loads((ROOT / "config/analysis-config.json").read_text(encoding="utf-8"))
    assert "function renderFlow()" in app, "Architecture flow renderer is missing"
    assert "function renderArchitectureMap()" in app and "function renderSystemArchitectureSvg" in app, "High-level architecture overview renderer is missing"
    assert "function createFlowScenarios()" in app and "animateMotion" in app, "Dynamic architecture scenarios are missing"
    assert "function renderClasses()" in app and "function createClassAreas()" in app, "Area class diagrams are missing"
    assert "data-copy-diagnostics" in app and "function formatDiagnosticsText" in app, "Diagnostic copy action is missing"
    assert "function syncPanelVisibility()" in app and "atlas.sidebarCollapsed" in app, "Persistent side panel controls are missing"
    for scenario in ("movement", "combat", "transition", "generation"):
        assert f'{scenario}:' in app, f"Architecture scenario is missing: {scenario}"
    assert 'data-local-kind' in app and 'data-local-page' in app, "Local relation controls are missing"
    assert ".architecture-diagram" in styles and ".diagram-connector" in styles, "Architecture sequence diagram styles are missing"
    assert ".flow-meaning-strip" in styles and "function flowEdgeLabel" in app, "Architecture flow visual meaning guide is missing"
    assert "minmax(220px, 280px)" in styles and ".architecture-diagram { display: block; width: 100%" in styles, "Architecture flow fit layout and detail proportions are missing"
    assert ".architecture-diagram" in styles and ".architecture-map" in styles and "margin-inline: auto" in styles, "Architecture diagrams must stay center-aligned while zooming"
    assert "data-flow-zoom" in app and "data-architecture-zoom" in app and "function diagramZoomStyle" in app, "Flow and architecture diagram zoom controls are missing"
    assert ".architecture-map" in styles and ".architecture-source" in styles, "High-level architecture overview styles are missing"
    assert ".architecture-intent-strip" in styles and "channel-badge" in app, "Architecture connection intent layout is missing"
    assert ".app-shell.is-sidebar-collapsed" in styles and ".app-shell.is-context-collapsed" in styles, "Side panel collapse layout is missing"
    assert ".sidebar-edge-toggle" in styles and ".context-edge-toggle" in styles, "Side panel controls must remain adjacent to their panels"
    assert ".class-diagram" in styles and ".class-node" in styles, "Class diagram styles are missing"
    assert ".relation-stages" in styles, "Ordered local relationship layout is missing"
    assert analysis_config.get("includeTests") is False, "TDD test code must remain outside architecture aggregation"
    assert analysis_config.get("sourceRoots") == [
        "02_Server",
        "03_Client/Assets/Scripts",
        "04_ClientNet",
        "98_Shared",
        "99_Tools/PacketGenerator",
    ], "Architecture input must remain limited to product code and PacketGenerator"

    print(f"Verified harness structure with {len(REQUIRED_FILES)} required files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
