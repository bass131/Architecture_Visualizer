(() => {
  "use strict";

  const data = window.ARCHITECTURE_DATA;
  const main = document.querySelector("#main-content");
  const tree = document.querySelector("#type-tree");
  const contextPanel = document.querySelector("#context-panel");
  const searchInput = document.querySelector("#search-input");
  const showGenerated = document.querySelector("#show-generated");
  const treeSummary = document.querySelector("#tree-summary");

  if (!data || data.schemaVersion !== "1.0") {
    main.innerHTML = `<div class="empty-state"><h2>분석 데이터를 불러오지 못했습니다.</h2><p><code>refresh.ps1</code>을 실행해 데이터를 생성하세요.</p></div>`;
    return;
  }

  const typeById = new Map(data.types.map(item => [item.id, item]));
  const methodById = new Map(data.methods.map(item => [item.id, item]));
  const methodsByType = groupBy(data.methods, item => item.typeId);
  const diagnosticsByType = groupBy(data.diagnostics, item => item.typeId);
  const outgoingByType = groupBy(data.relations, item => item.sourceId);
  const incomingByType = groupBy(data.relations, item => item.targetId);
  const flowScenarios = createFlowScenarios();
  const classAreas = createClassAreas();
  const state = {
    view: "overview",
    selectedTypeId: pickInitialType(),
    selectedMethodId: null,
    search: "",
    diagnosticSeverity: "all",
    diagnosticPrinciple: "all",
    layerFilter: null,
    flowScenario: "movement",
    flowSelectedNode: "input",
    flowPlaying: true,
    flowZoom: .85,
    classArea: "client",
    classSelectedTypeId: null,
    classRelationKind: "all",
    classLimit: 16,
    classZoom: 1,
    localRelationKind: "all",
    localRelationPage: 0,
  };

  document.querySelector("#generated-at").textContent =
    `${formatDate(data.generatedAtUtc)} · ${data.summary.files}개 파일`;

  bindEvents();
  syncTabs();
  renderTree();
  render();

  function bindEvents() {
    document.addEventListener("keydown", event => {
      if (event.key === "/" && document.activeElement !== searchInput) {
        event.preventDefault();
        searchInput.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchInput) {
        searchInput.value = "";
        state.search = "";
        searchInput.blur();
        renderTree();
      }
      const actionTarget = event.target.closest?.("[data-flow-node]");
      if (actionTarget && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        state.flowSelectedNode = actionTarget.dataset.flowNode;
        render();
      }
      const classTarget = event.target.closest?.("[data-class-type-id]");
      if (classTarget && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        state.classSelectedTypeId = classTarget.dataset.classTypeId;
        render();
      }
    });

    searchInput.addEventListener("input", () => {
      state.search = searchInput.value.trim().toLowerCase();
      state.layerFilter = null;
      renderTree();
    });
    showGenerated.addEventListener("change", renderTree);

    document.querySelectorAll(".tab").forEach(button => {
      button.addEventListener("click", () => setView(button.dataset.view));
    });

    document.querySelector("#help-button").addEventListener("click", () =>
      document.querySelector("#help-dialog").showModal());
    document.querySelector("#help-close").addEventListener("click", () =>
      document.querySelector("#help-dialog").close());

    tree.addEventListener("click", event => {
      const button = event.target.closest("[data-type-id]");
      if (button) selectType(button.dataset.typeId);
    });

    main.addEventListener("click", handleActionClick);
    contextPanel.addEventListener("click", handleActionClick);
  }

  function handleActionClick(event) {
    const typeTarget = event.target.closest("[data-type-id]");
    if (typeTarget) {
      selectType(typeTarget.dataset.typeId);
      return;
    }
    const methodTarget = event.target.closest("[data-method-id]");
    if (methodTarget) {
      selectMethod(methodTarget.dataset.methodId);
      return;
    }
    const layerTarget = event.target.closest("[data-layer]");
    if (layerTarget) {
      state.layerFilter = layerTarget.dataset.layer;
      state.view = "explorer";
      syncTabs();
      renderTree();
      render();
      return;
    }
    const severityTarget = event.target.closest("[data-severity]");
    if (severityTarget) {
      state.diagnosticSeverity = severityTarget.dataset.severity;
      render();
      return;
    }
    const principleTarget = event.target.closest("[data-principle]");
    if (principleTarget) {
      state.diagnosticPrinciple = principleTarget.dataset.principle;
      render();
      return;
    }
    const flowScenarioTarget = event.target.closest("[data-flow-scenario]");
    if (flowScenarioTarget) {
      state.flowScenario = flowScenarioTarget.dataset.flowScenario;
      state.flowSelectedNode = flowScenarios[state.flowScenario].nodes[0].id;
      render();
      return;
    }
    const flowNodeTarget = event.target.closest("[data-flow-node]");
    if (flowNodeTarget) {
      state.flowSelectedNode = flowNodeTarget.dataset.flowNode;
      render();
      return;
    }
    const flowPlayTarget = event.target.closest("[data-flow-play]");
    if (flowPlayTarget) {
      state.flowPlaying = !state.flowPlaying;
      render();
      return;
    }
    const flowZoomTarget = event.target.closest("[data-flow-zoom]");
    if (flowZoomTarget) {
      state.flowZoom = Math.min(1.25, Math.max(.7, state.flowZoom + Number(flowZoomTarget.dataset.flowZoom)));
      render();
      return;
    }
    const classAreaTarget = event.target.closest("[data-class-area]");
    if (classAreaTarget) {
      state.classArea = classAreaTarget.dataset.classArea;
      state.classSelectedTypeId = null;
      state.classRelationKind = "all";
      render();
      return;
    }
    const classTypeTarget = event.target.closest("[data-class-type-id]");
    if (classTypeTarget) {
      state.classSelectedTypeId = classTypeTarget.dataset.classTypeId;
      render();
      return;
    }
    const classKindTarget = event.target.closest("[data-class-kind]");
    if (classKindTarget) {
      state.classRelationKind = classKindTarget.dataset.classKind;
      render();
      return;
    }
    const classLimitTarget = event.target.closest("[data-class-limit]");
    if (classLimitTarget) {
      state.classLimit = Number(classLimitTarget.dataset.classLimit);
      render();
      return;
    }
    const classZoomTarget = event.target.closest("[data-class-zoom]");
    if (classZoomTarget) {
      state.classZoom = Math.min(1.3, Math.max(.7, state.classZoom + Number(classZoomTarget.dataset.classZoom)));
      render();
      return;
    }
    const localKindTarget = event.target.closest("[data-local-kind]");
    if (localKindTarget) {
      state.localRelationKind = localKindTarget.dataset.localKind;
      state.localRelationPage = 0;
      render();
      return;
    }
    const localPageTarget = event.target.closest("[data-local-page]");
    if (localPageTarget) {
      state.localRelationPage = Number(localPageTarget.dataset.localPage);
      render();
    }
  }

  function setView(view) {
    state.view = view;
    syncTabs();
    render();
  }

  function syncTabs() {
    document.querySelectorAll(".tab").forEach(button =>
      button.classList.toggle("is-active", button.dataset.view === state.view));
  }

  function selectType(typeId) {
    if (!typeById.has(typeId)) return;
    state.selectedTypeId = typeId;
    const typeMethods = methodsByType.get(typeId) || [];
    if (!typeMethods.some(method => method.id === state.selectedMethodId)) {
      state.selectedMethodId = typeMethods[0]?.id || null;
    }
    state.view = "explorer";
    syncTabs();
    renderTree();
    render();
    main.focus({ preventScroll: true });
  }

  function selectMethod(methodId) {
    const method = methodById.get(methodId);
    if (!method) return;
    state.selectedMethodId = methodId;
    state.selectedTypeId = method.typeId;
    state.view = "calls";
    syncTabs();
    renderTree();
    render();
  }

  function render() {
    if (state.view === "overview") renderOverview();
    else if (state.view === "flow") renderFlow();
    else if (state.view === "classes") renderClasses();
    else if (state.view === "diagnostics") renderDiagnostics();
    else if (state.view === "calls") renderCalls();
    else renderExplorer();
    renderContext();
  }

  function renderTree() {
    const visible = data.types.filter(isTypeVisible);
    treeSummary.textContent = `${visible.length} / ${data.types.length} 타입 표시`;
    const layers = groupBy(visible, item => item.layer);
    tree.innerHTML = [...layers.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([layer, types]) => {
      const folders = groupBy(types, item => shortFolder(item.folder, layer));
      const openLayer = types.some(type => type.id === state.selectedTypeId) || Boolean(state.search) || state.layerFilter === layer;
      return `<details ${openLayer ? "open" : ""}>
        <summary>${escapeHtml(layer)} <span class="tree-count">${types.length}</span></summary>
        <div class="tree-folder">
          ${[...folders.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([folder, folderTypes]) => `
            <details ${folderTypes.some(type => type.id === state.selectedTypeId) || state.search ? "open" : ""}>
              <summary>${escapeHtml(folder)} <span class="tree-count">${folderTypes.length}</span></summary>
              ${folderTypes.sort((a, b) => a.name.localeCompare(b.name)).map(type => `
                <button class="tree-type ${type.id === state.selectedTypeId ? "is-selected" : ""}" data-type-id="${attr(type.id)}">
                  <span class="kind-dot ${attr(type.kind)}"></span><span>${highlight(type.name, state.search)}</span>
                </button>`).join("")}
            </details>`).join("")}
        </div>
      </details>`;
    }).join("") || `<div class="empty-state">검색 결과가 없습니다.</div>`;
  }

  function isTypeVisible(type) {
    if (!showGenerated.checked && type.isGenerated) return false;
    if (state.layerFilter && type.layer !== state.layerFilter) return false;
    if (!state.search) return true;
    const methodText = (methodsByType.get(type.id) || []).map(method => method.name).join(" ");
    return `${type.name} ${type.fullName} ${type.file} ${methodText}`.toLowerCase().includes(state.search);
  }

  function renderOverview() {
    const summary = data.summary;
    main.innerHTML = `
      <header class="page-header">
        <div>
          <span class="eyebrow">SYSTEM MAP</span>
          <h1>코드가 아니라<br>구조에서 시작합니다.</h1>
          <p class="subtitle">DawnHolder의 서버, Unity 클라이언트, 공유 프로토콜, 네트워크 코어와 도구를 하나의 탐색 지도에서 연결합니다.</p>
        </div>
        <div class="source-ref">${escapeHtml(displaySourceRoot(data.sourceRoot))}</div>
      </header>
      <section class="stats-grid">
        ${stat("파일", summary.files)}${stat("타입", summary.types)}${stat("메서드", summary.methods)}
        ${stat("관계", summary.relations)}${stat("검토 신호", summary.diagnostics)}${stat("높은 신호", summary.highSeverity, "alert")}
      </section>
      <section class="panel">
        <div class="panel-header"><h2>아키텍처 흐름</h2><button class="link-button" data-view-link="flow">전체 흐름 열기</button></div>
        <div class="architecture-flow">
          ${flowNode("Unity Client", "입력, 렌더링, prediction")}
          ${flowNode("Client Network", "TCP 연결과 프레이밍")}
          ${flowNode("Shared", "패킷 계약과 게임 공식")}
          ${flowNode("Game Server", "검증, tick, 권위 상태")}
          ${flowNode("QA Tools", "헤드리스 시나리오 검증")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>레이어별 진입점</h2><span class="muted">클릭하면 해당 레이어만 탐색</span></div>
        <div class="layer-grid">
          ${data.projects.map(project => `<article class="layer-card" data-layer="${attr(project.name)}">
            <strong>${escapeHtml(project.name)}</strong>
            <div class="layer-metrics"><span>${project.types} types</span><span>${project.methods} methods</span><span>${project.diagnostics} signals</span></div>
          </article>`).join("")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>우선 검토 대상</h2><button class="link-button" data-view-link="diagnostics">SOLID 진단 전체 보기</button></div>
        <div class="diagnostic-list">${data.diagnostics.filter(item => item.severity === "high").slice(0, 8).map(diagnosticCard).join("") || empty("높은 신호가 없습니다.")}</div>
      </section>`;
    main.querySelector("[data-view-link='diagnostics']")?.addEventListener("click", () => setView("diagnostics"));
    main.querySelector("[data-view-link='flow']")?.addEventListener("click", () => setView("flow"));
  }

  function renderFlow() {
    const scenario = flowScenarios[state.flowScenario];
    const selectedNode = scenario.nodes.find(node => node.id === state.flowSelectedNode) || scenario.nodes[0];
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const animate = state.flowPlaying && !reducedMotion;

    main.innerHTML = `
      <header class="page-header">
        <div><span class="eyebrow">SYSTEM SEQUENCE</span><h1>전체 아키텍처 흐름</h1><p class="subtitle">원시 참조 수가 아니라 실제 런타임 책임과 전달 순서를 보여줍니다. 박스는 책임 단위, 직교선은 패킷·큐·상태 전달입니다.</p></div>
        <div class="source-ref">architecture evidence · 4 scenarios</div>
      </header>
      <div class="diagram-toolbar" aria-label="아키텍처 흐름 시나리오">
        <div class="scenario-tabs">
          ${Object.values(flowScenarios).map(item => `<button class="chip ${item.id === scenario.id ? "is-active" : ""}" data-flow-scenario="${attr(item.id)}">${escapeHtml(item.title)}</button>`).join("")}
        </div>
        <div class="diagram-actions">
          <div class="zoom-controls" aria-label="다이어그램 확대 축소"><button class="ghost-button" data-flow-zoom="-.1" aria-label="축소">−</button><span>${Math.round(state.flowZoom * 100)}%</span><button class="ghost-button" data-flow-zoom=".1" aria-label="확대">+</button></div>
          <button class="ghost-button motion-toggle" data-flow-play aria-pressed="${state.flowPlaying}">${reducedMotion ? "모션 감소 설정 적용" : animate ? "애니메이션 정지" : "애니메이션 재생"}</button>
        </div>
      </div>
      <section class="panel diagram-panel">
        <div class="diagram-heading"><div><span class="eyebrow">${escapeHtml(scenario.kicker)}</span><h2>${escapeHtml(scenario.title)}</h2></div><p>${escapeHtml(scenario.description)}</p></div>
        <div class="diagram-scroll">
          ${renderArchitectureDiagram(scenario, selectedNode.id, animate, state.flowZoom)}
        </div>
      </section>
      <div class="flow-detail-grid">
        <section class="panel selected-step-panel">
          <span class="eyebrow">SELECTED STEP</span><h2>${escapeHtml(selectedNode.title)}</h2>
          <p>${escapeHtml(selectedNode.detail)}</p>
          <div class="badge-row">${badge(selectedNode.lane, "accent")}${selectedNode.evidence.map(item => badge(item)).join("")}</div>
        </section>
        <section class="panel">
          <div class="panel-header"><h2>순서 목록</h2><span class="muted">다이어그램의 텍스트 대안</span></div>
          <ol class="flow-sequence-list">
            ${scenario.nodes.map((node, index) => `<li><button class="${node.id === selectedNode.id ? "is-selected" : ""}" data-flow-node="${attr(node.id)}"><span>${index + 1}</span><div><b>${escapeHtml(node.title)}</b><small>${escapeHtml(node.subtitle)}</small></div></button></li>`).join("")}
          </ol>
        </section>
      </div>`;
  }

  function renderArchitectureDiagram(scenario, selectedNodeId, animate, zoom) {
    const usedLaneIds = new Set(scenario.nodes.map(node => node.laneId));
    const usedLanes = scenario.lanes.filter(lane => usedLaneIds.has(lane.id))
      .map((lane, index) => ({ ...lane, y: 16 + index * 120 }));
    const laneY = new Map(usedLanes.map(lane => [lane.id, lane.y]));
    const layoutNodes = scenario.nodes.map((node, index) => ({ ...node, x: 64 + index * 230, y: laneY.get(node.laneId) + 25 }));
    const nodeById = new Map(layoutNodes.map(node => [node.id, node]));
    const diagramHeight = Math.max(...usedLanes.map(lane => lane.y + lane.height)) + 16;
    const diagramWidth = Math.max(1120, layoutNodes.at(-1).x + 240);
    const paths = scenario.edges.map((edge, index) => {
      const source = nodeById.get(edge.from);
      const target = nodeById.get(edge.to);
      const route = orthogonalPath(source, target);
      const labelWidth = Math.max(42, edge.label.length * 6 + 14);
      return `<g class="diagram-connector ${attr(edge.tone || "data")}">
        <path d="${route.path}" marker-end="url(#arrow-${attr(edge.tone || "data")})"></path>
        <rect class="connector-label-bg" x="${route.labelX - labelWidth / 2}" y="${route.labelY - 10}" width="${labelWidth}" height="16" rx="4"></rect>
        <text x="${route.labelX}" y="${route.labelY + 1}">${escapeHtml(edge.label)}</text>
        ${animate ? `<circle r="4"><animateMotion dur="${Math.max(2.4, scenario.edges.length * .38)}s" begin="${(index * .42).toFixed(2)}s" repeatCount="indefinite" path="${route.path}"></animateMotion></circle>` : ""}
      </g>`;
    }).join("");
    return `<svg class="architecture-diagram" style="width:${Math.round(diagramWidth * zoom)}px" viewBox="0 0 ${diagramWidth} ${diagramHeight}" role="group" aria-label="${attr(scenario.title)}">
      <defs>
        <pattern id="diagram-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" class="diagram-grid-line"></path></pattern>
        ${["intent", "data", "authority", "result"].map(tone => `<marker id="arrow-${tone}" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><polygon points="0 0, 9 3.5, 0 7"></polygon></marker>`).join("")}
      </defs>
      <rect class="diagram-grid-bg" width="100%" height="100%"></rect>
      ${usedLanes.map(lane => `<g class="diagram-lane"><rect x="8" y="${lane.y}" width="${diagramWidth - 16}" height="${lane.height}"></rect><text x="22" y="${lane.y + 25}">${escapeHtml(lane.title)}</text><text class="lane-caption" x="22" y="${lane.y + 43}">${escapeHtml(lane.caption)}</text></g>`).join("")}
      ${paths}
      ${layoutNodes.map((node, index) => `<g class="diagram-node ${node.id === selectedNodeId ? "is-selected" : ""} ${attr(node.tone || "data")}" data-flow-node="${attr(node.id)}" tabindex="0" role="button" aria-label="${index + 1}. ${attr(node.title)}" transform="translate(${node.x} ${node.y})">
        <rect width="176" height="72"></rect><circle cx="16" cy="16" r="10"></circle><text class="node-order" x="16" y="20">${index + 1}</text><text class="node-title" x="32" y="25">${escapeHtml(node.title)}</text><text class="node-subtitle" x="14" y="50">${escapeHtml(node.subtitle)}</text><text class="node-layer" x="14" y="64">${escapeHtml(node.layer)}</text>
      </g>`).join("")}
    </svg>`;
  }

  function orthogonalPath(source, target) {
    const startX = source.x + 176;
    const startY = source.y + 36;
    const endX = target.x;
    const endY = target.y + 36;
    const middleX = startX + Math.max(24, (endX - startX) / 2);
    return {
      path: `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`,
      labelX: middleX,
      labelY: source.y === target.y ? startY - 13 : (startY + endY) / 2,
    };
  }

  function renderClasses() {
    const area = classAreas[state.classArea];
    const areaTypes = data.types.filter(type => area.layers.includes(type.layer) && !type.isGenerated);
    const areaIds = new Set(areaTypes.map(type => type.id));
    const allRelations = data.relations.filter(relation => areaIds.has(relation.sourceId) && areaIds.has(relation.targetId));
    const relations = allRelations.filter(relation => state.classRelationKind === "all" || relation.kind === state.classRelationKind);
    const ranked = [...areaTypes].sort((a, b) => classTypeScore(b) - classTypeScore(a) || a.name.localeCompare(b.name));
    if (!state.classSelectedTypeId || !areaIds.has(state.classSelectedTypeId)) state.classSelectedTypeId = ranked[0]?.id || null;
    const selected = typeById.get(state.classSelectedTypeId);
    const visibleTypes = selectClassDiagramTypes(selected, ranked, relations, state.classLimit);
    const visibleIds = new Set(visibleTypes.map(type => type.id));
    const visibleRelations = relations.filter(relation => visibleIds.has(relation.sourceId) && visibleIds.has(relation.targetId))
      .sort((a, b) => classRelationPriority(b, selected?.id) - classRelationPriority(a, selected?.id))
      .slice(0, 42);
    const kinds = relationKinds(allRelations);
    const selectedRelations = relations.filter(relation => relation.sourceId === selected?.id || relation.targetId === selected?.id);

    main.innerHTML = `
      <header class="page-header">
        <div><span class="eyebrow">CLASS DIAGRAM</span><h1>영역별 클래스 맵</h1><p class="subtitle">영역의 핵심 타입을 결합도 순으로 추리고, 선택 타입의 직접 관계를 우선 배치합니다. 선은 관계 종류를 나타내며 노드 뒤로 지나갑니다.</p></div>
        <div class="source-ref">${areaTypes.length} types · ${allRelations.length} internal relations</div>
      </header>
      <div class="class-toolbar">
        <div class="scenario-tabs" aria-label="클래스 영역">
          ${Object.values(classAreas).map(item => `<button class="chip ${item.id === area.id ? "is-active" : ""}" data-class-area="${attr(item.id)}">${escapeHtml(item.title)}</button>`).join("")}
        </div>
        <div class="diagram-actions">
          <div class="zoom-controls" aria-label="클래스 다이어그램 확대 축소"><button class="ghost-button" data-class-zoom="-.1" aria-label="축소">−</button><span>${Math.round(state.classZoom * 100)}%</span><button class="ghost-button" data-class-zoom=".1" aria-label="확대">+</button></div>
          <div class="class-limit-controls" aria-label="표시 타입 개수">${[12, 16, 20].map(limit => `<button class="chip ${state.classLimit === limit ? "is-active" : ""}" data-class-limit="${limit}">${limit}개</button>`).join("")}</div>
        </div>
      </div>
      <div class="class-kind-toolbar" aria-label="클래스 관계 종류">
        ${chip("전체 관계", "class-kind", "all", state.classRelationKind)}
        ${kinds.map(kind => chip(`${kind.kind} ${kind.count}`, "class-kind", kind.kind, state.classRelationKind)).join("")}
      </div>
      <section class="panel diagram-panel">
        <div class="diagram-heading"><div><span class="eyebrow">${escapeHtml(area.kicker)}</span><h2>${escapeHtml(area.title)}</h2></div><p>${escapeHtml(area.description)}</p></div>
        <div class="diagram-scroll">${renderClassDiagram(visibleTypes, visibleRelations, selected?.id, state.classZoom)}</div>
      </section>
      <div class="flow-detail-grid">
        <section class="panel selected-step-panel">
          <span class="eyebrow">SELECTED TYPE</span><h2>${escapeHtml(selected?.name || "선택 없음")}</h2>
          ${selected ? `<p>${escapeHtml(selected.fullName)}</p><div class="badge-row">${badge(selected.kind, "accent")}${badge(selected.layer)}${badge(`${selected.methodCount} methods`)}${badge(`fan ${selected.fanIn}/${selected.fanOut}`)}</div><button class="link-button class-open-button" data-type-id="${attr(selected.id)}">구조 탐색에서 열기</button>` : ""}
        </section>
        <section class="panel">
          <div class="panel-header"><h2>선택 타입 관계</h2><span class="muted">${selectedRelations.length} relations</span></div>
          <div class="class-relation-list">${selectedRelations.slice(0, 16).map(relation => classRelationItem(relation, selected.id)).join("") || empty("선택한 조건의 직접 관계가 없습니다.")}</div>
        </section>
      </div>`;
  }

  function renderClassDiagram(types, relations, selectedTypeId, zoom) {
    const columns = 4;
    const nodeWidth = 210, nodeHeight = 104, gapX = 62, gapY = 54, marginX = 44, marginY = 44;
    const nodes = types.map((type, index) => ({
      type,
      x: marginX + (index % columns) * (nodeWidth + gapX),
      y: marginY + Math.floor(index / columns) * (nodeHeight + gapY),
    }));
    const nodeById = new Map(nodes.map(node => [node.type.id, node]));
    const width = marginX * 2 + columns * nodeWidth + (columns - 1) * gapX;
    const rows = Math.max(1, Math.ceil(nodes.length / columns));
    const height = marginY * 2 + rows * nodeHeight + (rows - 1) * gapY;
    const edges = relations.map(relation => {
      const source = nodeById.get(relation.sourceId);
      const target = nodeById.get(relation.targetId);
      if (!source || !target) return "";
      return `<path class="class-edge ${attr(relation.kind)} ${relation.sourceId === selectedTypeId || relation.targetId === selectedTypeId ? "is-focused" : ""}" d="${classEdgePath(source, target, nodeWidth, nodeHeight)}" marker-end="url(#class-arrow-${attr(relation.kind)})"></path>`;
    }).join("");
    return `<svg class="class-diagram" style="width:${Math.round(width * zoom)}px" viewBox="0 0 ${width} ${height}" role="group" aria-label="영역별 클래스 다이어그램">
      <defs>
        <pattern id="class-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" class="diagram-grid-line"></path></pattern>
        ${["inherits", "implements", "uses", "creates", "calls"].map(kind => `<marker id="class-arrow-${kind}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6"></polygon></marker>`).join("")}
      </defs>
      <rect class="diagram-grid-bg" width="100%" height="100%"></rect>
      <g class="class-edges">${edges}</g>
      ${nodes.map(node => classDiagramNode(node.type, node.x, node.y, nodeWidth, nodeHeight, node.type.id === selectedTypeId)).join("")}
    </svg>`;
  }

  function classDiagramNode(type, x, y, width, height, selected) {
    const members = type.members.slice(0, 2).map(member => `${member.kind} ${member.name}`);
    return `<g class="class-node ${selected ? "is-selected" : ""} ${attr(type.kind)}" data-class-type-id="${attr(type.id)}" tabindex="0" role="button" aria-label="${attr(type.name)}" transform="translate(${x} ${y})">
      <rect width="${width}" height="${height}"></rect><line x1="0" y1="34" x2="${width}" y2="34"></line><line x1="0" y1="76" x2="${width}" y2="76"></line>
      <text class="class-stereotype" x="10" y="13">«${escapeHtml(type.kind)}»</text><text class="class-title" x="10" y="28">${escapeHtml(truncate(type.name, 28))}</text>
      ${members.map((member, index) => `<text class="class-member" x="10" y="${51 + index * 15}">${escapeHtml(truncate(member, 31))}</text>`).join("")}
      <text class="class-meta" x="10" y="94">${type.methodCount} methods · fan ${type.fanIn}/${type.fanOut}</text>
    </g>`;
  }

  function classEdgePath(source, target, width, height) {
    const sourceCenterX = source.x + width / 2, sourceCenterY = source.y + height / 2;
    const targetCenterX = target.x + width / 2, targetCenterY = target.y + height / 2;
    if (source.x === target.x) {
      const down = target.y > source.y;
      const startY = down ? source.y + height : source.y;
      const endY = down ? target.y : target.y + height;
      const trackX = sourceCenterX + 22;
      return `M ${sourceCenterX} ${startY} H ${trackX} V ${endY} H ${targetCenterX}`;
    }
    const right = target.x > source.x;
    const startX = right ? source.x + width : source.x;
    const endX = right ? target.x : target.x + width;
    const middleX = (startX + endX) / 2;
    return `M ${startX} ${sourceCenterY} H ${middleX} V ${targetCenterY} H ${endX}`;
  }

  function selectClassDiagramTypes(selected, ranked, relations, limit) {
    if (!selected) return ranked.slice(0, limit);
    const relationCounts = new Map();
    relations.forEach(relation => {
      if (relation.sourceId === selected.id) relationCounts.set(relation.targetId, (relationCounts.get(relation.targetId) || 0) + 1);
      if (relation.targetId === selected.id) relationCounts.set(relation.sourceId, (relationCounts.get(relation.sourceId) || 0) + 1);
    });
    const neighbors = [...relationCounts.entries()].sort((a, b) => b[1] - a[1] || classTypeScore(typeById.get(b[0])) - classTypeScore(typeById.get(a[0]))).map(([id]) => typeById.get(id));
    const result = [selected, ...neighbors];
    ranked.forEach(type => { if (!result.some(item => item.id === type.id)) result.push(type); });
    return result.slice(0, limit);
  }

  function classRelationItem(relation, selectedTypeId) {
    const outgoing = relation.sourceId === selectedTypeId;
    const other = typeById.get(outgoing ? relation.targetId : relation.sourceId);
    return `<button class="class-relation-item" data-class-type-id="${attr(other?.id || "")}"><span>${outgoing ? "OUT" : "IN"}</span><b>${escapeHtml(relation.kind)}</b><small>${escapeHtml(other?.name || "Unknown")}</small></button>`;
  }

  function classTypeScore(type) { return type ? type.fanIn + type.fanOut + type.methodCount * .25 : 0; }
  function classRelationPriority(relation, selectedTypeId) { return (relation.sourceId === selectedTypeId || relation.targetId === selectedTypeId ? 100 : 0) + ({ inherits: 8, implements: 7, creates: 4, calls: 3, uses: 1 }[relation.kind] || 0); }
  function truncate(value, length) { return value.length > length ? `${value.slice(0, length - 1)}…` : value; }

  function renderExplorer() {
    const type = typeById.get(state.selectedTypeId) || data.types[0];
    if (!type) { main.innerHTML = empty("표시할 타입이 없습니다."); return; }
    const diagnostics = diagnosticsByType.get(type.id) || [];
    const methods = methodsByType.get(type.id) || [];
    const outgoing = (outgoingByType.get(type.id) || []).filter(relation => relationEndpointVisible(relation.targetId));
    const incoming = (incomingByType.get(type.id) || []).filter(relation => relationEndpointVisible(relation.sourceId));
    main.innerHTML = `
      <header class="page-header">
        <div>
          <span class="eyebrow">${escapeHtml(type.layer)} / ${escapeHtml(type.kind.toUpperCase())}</span>
          <h1>${escapeHtml(type.name)}</h1>
          <p class="subtitle">${escapeHtml(type.fullName)}</p>
          <div class="badge-row">
            ${type.patterns.map(pattern => badge(pattern, "accent")).join("")}
            ${type.responsibilities.map(item => badge(item)).join("")}
            ${diagnostics.map(item => badge(`${item.principle}: ${item.title}`, item.severity)).join("")}
          </div>
        </div>
        <div class="source-ref">${escapeHtml(type.file)}:${type.startLine}</div>
      </header>
      <section class="metrics-row">
        ${metric("Lines", type.sourceLines)}${metric("Members", type.memberCount)}${metric("Methods", type.methodCount)}
        ${metric("Fan in", type.fanIn)}${metric("Fan out", type.fanOut)}${metric("Inheritance", type.inheritanceDepth)}
      </section>
      <div class="detail-grid">
        <section class="panel">
          <div class="panel-header"><h2>로컬 관계 단계</h2><span class="muted">들어옴 → 현재 → 나감</span></div>
          ${renderGraph(type, outgoing, incoming)}
        </section>
        <section class="panel">
          <div class="panel-header"><h2>의존 관계</h2><span class="muted">out ${outgoing.length} / in ${incoming.length}</span></div>
          <div class="relation-list">
            ${outgoing.slice(0, 12).map(relation => relationItem(relation, "out")).join("")}
            ${incoming.slice(0, 8).map(relation => relationItem(relation, "in")).join("")}
            ${outgoing.length + incoming.length ? "" : empty("프로젝트 내부 관계가 없습니다.")}
          </div>
        </section>
      </div>
      <div class="detail-grid">
        <section class="panel">
          <div class="panel-header"><h2>메서드</h2><span class="muted">클릭하면 호출 탐색</span></div>
          <div class="method-list">${methods.map(methodItem).join("") || empty("메서드가 없습니다.")}</div>
        </section>
        <section class="panel">
          <div class="panel-header"><h2>멤버와 진단</h2><span class="muted">${type.members.length} members</span></div>
          <div class="member-list">${type.members.slice(0, 30).map(member => `<div class="member-item"><span class="relation-kind">${escapeHtml(member.kind)}</span><span class="method-signature">${escapeHtml(member.type)} ${escapeHtml(member.name)}</span></div>`).join("")}</div>
          ${diagnostics.length ? `<div class="diagnostic-list" style="margin-top:14px">${diagnostics.map(diagnosticCard).join("")}</div>` : ""}
        </section>
      </div>`;
  }

  function renderCalls() {
    let method = methodById.get(state.selectedMethodId);
    if (!method) {
      const candidates = data.methods.filter(item => item.calls.length || item.calledBy.length)
        .sort((a, b) => (b.calls.length + b.calledBy.length) - (a.calls.length + a.calledBy.length));
      method = candidates[0];
      state.selectedMethodId = method?.id || null;
      if (method) state.selectedTypeId = method.typeId;
    }
    if (!method) { main.innerHTML = empty("호출 관계가 해석된 메서드가 없습니다."); return; }
    const owner = typeById.get(method.typeId);
    const unresolved = method.unresolvedCalls.length;
    main.innerHTML = `
      <header class="page-header">
        <div>
          <span class="eyebrow">CALL STACK EXPLORER</span>
          <h1>${escapeHtml(owner?.name || "Unknown")}.${escapeHtml(method.name)}</h1>
          <p class="subtitle">호출 대상과 역호출자를 최대 4단계까지 따라갑니다. 순환 경로는 반복 표시하지 않습니다.</p>
          <div class="badge-row">${badge(`${method.calls.length} outbound`, "accent")}${badge(`${method.calledBy.length} inbound`)}${badge(`${unresolved} unresolved`, unresolved > 8 ? "medium" : "")}</div>
        </div>
        <div class="source-ref">${escapeHtml(method.file)}:${method.startLine}</div>
      </header>
      <section class="panel">
        <div class="panel-header"><h2>현재 프레임</h2><button class="link-button" data-type-id="${attr(method.typeId)}">소유 타입 보기</button></div>
        <div class="method-item is-selected"><div><div class="method-signature">${escapeHtml(method.signature)}</div><div class="method-meta">returns ${escapeHtml(method.returnType)} · ${method.sourceLines} lines</div></div></div>
      </section>
      <div class="call-columns">
        <section class="panel"><div class="panel-header"><h2>호출 대상</h2><span class="muted">outbound</span></div>${renderCallTree(method.id, "calls")}</section>
        <section class="panel"><div class="panel-header"><h2>역호출자</h2><span class="muted">inbound</span></div>${renderCallTree(method.id, "calledBy")}</section>
      </div>
      <section class="panel">
        <div class="panel-header"><h2>해석되지 않은 호출 이름</h2><span class="muted">프레임워크 API, 체인 호출, 동적 바인딩 포함</span></div>
        <div class="badge-row">${method.unresolvedCalls.slice(0, 80).map(name => badge(name)).join("") || '<span class="muted">없음</span>'}</div>
      </section>`;
  }

  function renderDiagnostics() {
    const principles = [...new Set(data.diagnostics.map(item => item.principle))].sort();
    const filtered = data.diagnostics.filter(item =>
      (state.diagnosticSeverity === "all" || item.severity === state.diagnosticSeverity) &&
      (state.diagnosticPrinciple === "all" || item.principle === state.diagnosticPrinciple));
    main.innerHTML = `
      <header class="page-header"><div><span class="eyebrow">DESIGN REVIEW</span><h1>SOLID와 결합도 신호</h1><p class="subtitle">자동 판정이 아닌 검토 목록입니다. 클래스가 실제로 몇 가지 이유로 변경되는지, 추상화가 이해 비용을 줄이는지 확인하세요.</p></div><div class="source-ref">${filtered.length} signals</div></header>
      <div class="diagnostic-toolbar">
        ${chip("전체 심각도", "severity", "all", state.diagnosticSeverity)}${chip("높음", "severity", "high", state.diagnosticSeverity)}${chip("중간", "severity", "medium", state.diagnosticSeverity)}
      </div>
      <div class="diagnostic-toolbar">
        ${chip("전체 원칙", "principle", "all", state.diagnosticPrinciple)}${principles.map(value => chip(value, "principle", value, state.diagnosticPrinciple)).join("")}
      </div>
      <section class="diagnostic-list">${filtered.map(diagnosticCard).join("") || empty("조건에 맞는 진단이 없습니다.")}</section>`;
  }

  function renderContext() {
    if (state.view === "flow") {
      const scenario = flowScenarios[state.flowScenario];
      const selectedNode = scenario.nodes.find(node => node.id === state.flowSelectedNode) || scenario.nodes[0];
      contextPanel.innerHTML = `
        <section class="context-card"><span class="eyebrow">ACTIVE FLOW</span><h3>${escapeHtml(scenario.title)}</h3><p>${escapeHtml(scenario.description)}</p></section>
        <section class="context-card"><span class="eyebrow">SELECTED STEP</span><h3>${escapeHtml(selectedNode.title)}</h3><p>${escapeHtml(selectedNode.detail)}</p><div class="badge-row">${badge(selectedNode.lane, "accent")}${selectedNode.evidence.map(item => badge(item)).join("")}</div></section>
        <section class="context-card"><h3>표현 규칙</h3><p>파랑은 사용자 의도, 주황은 서버 권위 처리, 청록은 확정 결과를 뜻합니다. 움직이는 점은 처리 순서이며 실제 시간이나 호출 빈도를 의미하지 않습니다.</p></section>`;
      return;
    }
    if (state.view === "classes") {
      const area = classAreas[state.classArea];
      const selected = typeById.get(state.classSelectedTypeId);
      contextPanel.innerHTML = `
        <section class="context-card"><span class="eyebrow">CLASS AREA</span><h3>${escapeHtml(area.title)}</h3><p>${escapeHtml(area.description)}</p></section>
        ${selected ? `<section class="context-card"><span class="eyebrow">SELECTED TYPE</span><h3>${escapeHtml(selected.name)}</h3><p>${escapeHtml(selected.file)}:${selected.startLine}</p><div class="badge-row">${badge(selected.kind, "accent")}${badge(selected.layer)}${badge(`${selected.memberCount} members`)}</div><button class="link-button" data-type-id="${attr(selected.id)}">구조 탐색에서 열기</button></section>` : ""}
        <section class="context-card"><h3>관계 색상</h3><p><span class="class-legend inherits"></span> 상속 · <span class="class-legend implements"></span> 구현</p><p><span class="class-legend creates"></span> 생성 · <span class="class-legend calls"></span> 호출 · <span class="class-legend uses"></span> 사용</p></section>`;
      return;
    }
    const type = typeById.get(state.selectedTypeId);
    if (!type) return;
    const method = methodById.get(state.selectedMethodId);
    const outgoing = (outgoingByType.get(type.id) || []).filter(relation => relationEndpointVisible(relation.targetId));
    const incoming = (incomingByType.get(type.id) || []).filter(relation => relationEndpointVisible(relation.sourceId));
    const diagnostics = diagnosticsByType.get(type.id) || [];
    contextPanel.innerHTML = `
      <section class="context-card"><span class="eyebrow">PINNED TYPE</span><h3>${escapeHtml(type.name)}</h3><p>${escapeHtml(type.file)}:${type.startLine}</p><div class="badge-row">${badge(type.kind)}${badge(type.layer, "accent")}</div></section>
      ${method ? `<section class="context-card"><span class="eyebrow">PINNED METHOD</span><h3>${escapeHtml(method.name)}</h3><p>${escapeHtml(method.signature)}</p><button class="link-button" data-method-id="${attr(method.id)}">호출 트리 열기</button></section>` : ""}
      <section class="context-card"><h3>나가는 관계</h3><div class="context-list">${outgoing.slice(0, 9).map(relation => contextRelation(relation, "out")).join("") || `<p>없음</p>`}</div></section>
      <section class="context-card"><h3>들어오는 관계</h3><div class="context-list">${incoming.slice(0, 9).map(relation => contextRelation(relation, "in")).join("") || `<p>없음</p>`}</div></section>
      <section class="context-card"><h3>검토 신호</h3>${diagnostics.map(item => `<p><span class="badge ${item.severity}">${escapeHtml(item.principle)}</span> ${escapeHtml(item.title)}</p>`).join("") || `<p>현재 신호 없음</p>`}</section>`;
  }

  function renderGraph(type, outgoing, incoming) {
    const all = [...incoming.map(item => ({ ...item, direction: "in" })), ...outgoing.map(item => ({ ...item, direction: "out" }))]
      .filter((item, index, array) => array.findIndex(other => `${other.sourceId}|${other.targetId}|${other.kind}` === `${item.sourceId}|${item.targetId}|${item.kind}`) === index);
    const kinds = relationKinds(all);
    const filteredIncoming = incoming.filter(item => state.localRelationKind === "all" || item.kind === state.localRelationKind);
    const filteredOutgoing = outgoing.filter(item => state.localRelationKind === "all" || item.kind === state.localRelationKind);
    const pageSize = 6;
    const pageCount = Math.max(1, Math.ceil(Math.max(filteredIncoming.length, filteredOutgoing.length) / pageSize));
    state.localRelationPage = Math.min(state.localRelationPage, pageCount - 1);
    const start = state.localRelationPage * pageSize;
    const incomingPage = filteredIncoming.slice(start, start + pageSize);
    const outgoingPage = filteredOutgoing.slice(start, start + pageSize);
    return `<div class="local-relation-view">
      <div class="local-relation-toolbar" aria-label="로컬 관계 종류 필터">
        ${chip("전체", "local-kind", "all", state.localRelationKind)}
        ${kinds.map(kind => chip(`${kind.kind} ${kind.count}`, "local-kind", kind.kind, state.localRelationKind)).join("")}
      </div>
      <div class="relation-stages" role="group" aria-label="${attr(type.name)}의 들어오는 관계, 현재 타입, 나가는 관계">
        ${relationStage("1. 들어오는 관계", `${filteredIncoming.length}개`, incomingPage, "in")}
        <section class="relation-stage current-stage"><header><span>2. 현재 타입</span><small>${escapeHtml(type.layer)}</small></header>${localTypeNode(type, null, true)}</section>
        ${relationStage("3. 나가는 관계", `${filteredOutgoing.length}개`, outgoingPage, "out")}
      </div>
      ${pageCount > 1 ? `<div class="relation-pagination"><button class="chip" data-local-page="${Math.max(0, state.localRelationPage - 1)}" ${state.localRelationPage === 0 ? "disabled" : ""}>이전</button><span>${state.localRelationPage + 1} / ${pageCount}</span><button class="chip" data-local-page="${Math.min(pageCount - 1, state.localRelationPage + 1)}" ${state.localRelationPage === pageCount - 1 ? "disabled" : ""}>다음</button></div>` : ""}
    </div>`;
  }

  function relationStage(title, count, relations, direction) {
    return `<section class="relation-stage"><header><span>${title}</span><small>${count}</small></header><div class="stage-node-list">${relations.map(relation => {
      const targetId = direction === "out" ? relation.targetId : relation.sourceId;
      return localTypeNode(typeById.get(targetId), relation, false);
    }).join("") || empty("표시할 관계가 없습니다.")}</div></section>`;
  }

  function localTypeNode(type, relation, selected) {
    if (!type) return "";
    return `<button class="local-type-node ${selected ? "is-current" : ""}" ${selected ? "disabled" : `data-type-id="${attr(type.id)}"`} title="${attr(type.fullName)}">
      ${relation ? `<span class="node-relation ${attr(relation.kind)}">${escapeHtml(relation.kind)}</span>` : '<span class="node-relation">selected</span>'}
      <b>${escapeHtml(type.name)}</b><span>${escapeHtml(type.kind)} · ${escapeHtml(type.layer)}</span>
    </button>`;
  }

  function createFlowScenarios() {
    const lanes = [
      { id: "client", title: "Unity Client", caption: "입력 · 예측 · 표현", y: 16, height: 108 },
      { id: "transport", title: "Transport", caption: "ClientNet · Server Network", y: 136, height: 108 },
      { id: "contract", title: "Shared Contract", caption: "패킷 · ID · 게임 데이터", y: 256, height: 108 },
      { id: "server", title: "Authoritative Server", caption: "검증 · tick · 상태 변경", y: 376, height: 108 },
      { id: "qa", title: "QA Automation", caption: "헤드리스 시나리오 · assertion", y: 496, height: 108 },
    ];
    const position = (lane, x) => ({ x, y: lanes.find(item => item.id === lane).y + 25 });
    const node = (id, title, subtitle, lane, x, layer, detail, evidence, tone = "data") => ({
      id, title, subtitle, laneId: lane, lane: lanes.find(item => item.id === lane).title, layer, detail, evidence, tone, ...position(lane, x),
    });
    const base = { width: 1680, height: 620, lanes };
    return {
      movement: {
        ...base, id: "movement", title: "이동 동기화", kicker: "PLAYER MOVEMENT",
        description: "입력은 클라이언트에서 즉시 예측되지만 최종 위치는 서버 tick 검증과 snapshot으로 확정됩니다.",
        nodes: [
          node("input", "입력 감지", "Input → intent", "client", 68, "Unity Client", "플레이어 입력을 위치가 아닌 이동 의도로 변환합니다.", ["Input", "intent"], "intent"),
          node("predict", "로컬 예측", "즉시 화면 반영", "client", 270, "Unity Client", "본인 캐릭터만 선반영해 입력 지연을 숨깁니다.", ["prediction", "local only"], "intent"),
          node("move-packet", "C_MoveIntent", "tick + input bits", "contract", 472, "Shared", "공유 패킷 계약에 tick과 입력 비트를 기록합니다.", ["packet", "append-only ID"]),
          node("client-send", "클라 프레이밍", "length-prefixed TCP", "transport", 674, "Client Network", "ClientNet이 패킷을 frame으로 만들고 TCP로 전송합니다.", ["ClientSession", "SendBuffer"]),
          node("server-recv", "서버 수신", "frame → handler", "transport", 876, "Server Network", "서버 socket 계층이 frame을 복원해 게임 세션으로 넘깁니다.", ["PacketSession", "Session"]),
          node("move-validate", "입력 검증", "범위 · 충돌 · 속도", "server", 1078, "Game Server", "서버가 클라이언트 위치를 신뢰하지 않고 이동 가능성을 검증합니다.", ["MoveIntentHandler", "trust boundary"], "authority"),
          node("tick", "Tick 확정", "20 TPS state update", "server", 1280, "Game Server", "tick thread에서 권위 위치를 확정하고 snapshot을 만듭니다.", ["GameMap", "S_Snapshot"], "authority"),
          node("reconcile", "재조정", "snapshot 비교 · 보간", "client", 1482, "Unity Client", "서버 snapshot과 예측 결과를 비교해 snap 또는 보간합니다.", ["reconciliation", "render"], "result"),
        ],
        edges: [
          { from: "input", to: "predict", label: "intent", tone: "intent" },
          { from: "predict", to: "move-packet", label: "encode", tone: "intent" },
          { from: "move-packet", to: "client-send", label: "bytes" },
          { from: "client-send", to: "server-recv", label: "TCP frame" },
          { from: "server-recv", to: "move-validate", label: "dispatch" },
          { from: "move-validate", to: "tick", label: "enqueue", tone: "authority" },
          { from: "tick", to: "reconcile", label: "S_Snapshot", tone: "result" },
        ],
      },
      combat: {
        ...base, id: "combat", title: "전투 처리", kicker: "SERVER-AUTHORITATIVE COMBAT",
        description: "클라이언트는 공격 의도만 보내고 거리, 생존, rate limit, 피해 적용은 서버 tick에서 처리합니다.",
        nodes: [
          node("attack-input", "공격 입력", "target 선택", "client", 68, "Unity Client", "클라이언트는 대상 ID를 선택하지만 피해량은 결정하지 않습니다.", ["AttackIntent", "target only"], "intent"),
          node("attack-packet", "C_Attack", "target + client tick", "contract", 270, "Shared", "공격 의도를 공유 wire 계약으로 직렬화합니다.", ["C_Attack", "ProtocolVersion"]),
          node("attack-send", "패킷 전송", "TCP framing", "transport", 472, "Client/Server Network", "분리된 양쪽 socket 계층이 동일 패킷 바이트를 전달합니다.", ["ClientNet", "ServerCore"]),
          node("attack-handler", "AttackHandler", "decode only", "server", 674, "Game Server", "handler는 decode와 세션 게이트만 수행하고 상태를 직접 변경하지 않습니다.", ["IPacketHandler", "decode-only"], "authority"),
          node("attack-queue", "Map Job Queue", "tick thread handoff", "server", 876, "Game Server", "공격 작업을 해당 맵 actor의 tick thread로 전달합니다.", ["GameMap.EnqueueJob", "no await"], "authority"),
          node("attack-validate", "6단계 검증", "range · alive · rate", "server", 1078, "Game Server", "서버 위치를 기준으로 공격 가능성과 중복 요청을 검증합니다.", ["ProcessAttack", "trust boundary"], "authority"),
          node("combat-result", "상태 확정", "HP · death · clear", "server", 1280, "Game Server", "HP mutation 뒤 hit, death, stage clear 이벤트를 순서대로 만듭니다.", ["S_HitResult", "S_EntityDeath", "S_StageClear"], "authority"),
          node("combat-render", "결과 표현", "effect · UI · despawn", "client", 1482, "Unity Client", "서버 결과를 받아 피해 효과, 사망, 스테이지 UI를 갱신합니다.", ["DamageFlash", "StageClear UI"], "result"),
        ],
        edges: [
          { from: "attack-input", to: "attack-packet", label: "intent", tone: "intent" },
          { from: "attack-packet", to: "attack-send", label: "encode" },
          { from: "attack-send", to: "attack-handler", label: "dispatch" },
          { from: "attack-handler", to: "attack-queue", label: "submit", tone: "authority" },
          { from: "attack-queue", to: "attack-validate", label: "tick", tone: "authority" },
          { from: "attack-validate", to: "combat-result", label: "mutate", tone: "authority" },
          { from: "combat-result", to: "combat-render", label: "broadcast", tone: "result" },
        ],
      },
      transition: {
        ...base, id: "transition", title: "맵 전환", kicker: "MAP MIGRATION",
        description: "포털 의도를 검증한 뒤 기존 맵에서 제거하고 목적 맵 actor에 같은 entity ID로 등록합니다.",
        nodes: [
          node("portal-input", "포털 진입", "portalId intent", "client", 68, "Unity Client", "목적지 좌표가 아니라 portalId만 서버에 제안합니다.", ["C_EnterPortal", "no position"], "intent"),
          node("portal-send", "전환 요청", "session 유지", "transport", 270, "Client Network", "기존 TCP 세션을 유지한 채 전환 패킷을 전송합니다.", ["NetworkService", "persistent session"]),
          node("portal-handler", "Portal Handler", "gate + submit", "server", 472, "Game Server", "handshake와 class 상태를 확인하고 현재 맵에 작업을 넣습니다.", ["EnterPortalHandler", "SubmitEnterPortal"], "authority"),
          node("portal-validate", "포털 검증", "ID · 거리 · 상태", "server", 674, "Game Server", "현재 위치와 portal table을 기준으로 전환 가능성을 검증합니다.", ["PortalTable", "distance ≤ 2"], "authority"),
          node("remove-map", "Map A 제거", "leave broadcast", "server", 876, "Game Server", "기존 맵 actor에서 플레이어를 제거하고 leave를 브로드캐스트합니다.", ["RemovePlayer", "S_PlayerLeave"], "authority"),
          node("add-map", "Map B 등록", "entity ID 유지", "server", 1078, "Game Server", "목적 맵 job queue에서 동일 entity ID로 플레이어를 추가합니다.", ["AddPlayerWithId", "ADR-026"], "authority"),
          node("transition-packet", "S_MapTransition", "map + spawn", "contract", 1280, "Shared", "목적 mapId와 spawn 좌표를 본인에게만 통지합니다.", ["destMapId", "spawnX/Y"], "result"),
          node("scene-load", "씬 전환", "roster drain", "client", 1482, "Unity Client", "연결을 유지한 채 씬을 로드하고 버퍼링된 roster를 반영합니다.", ["SceneRouter", "RosterTransitionBuffer"], "result"),
        ],
        edges: [
          { from: "portal-input", to: "portal-send", label: "C_EnterPortal", tone: "intent" },
          { from: "portal-send", to: "portal-handler", label: "dispatch" },
          { from: "portal-handler", to: "portal-validate", label: "enqueue", tone: "authority" },
          { from: "portal-validate", to: "remove-map", label: "approved", tone: "authority" },
          { from: "remove-map", to: "add-map", label: "map handoff", tone: "authority" },
          { from: "add-map", to: "transition-packet", label: "result", tone: "result" },
          { from: "transition-packet", to: "scene-load", label: "notify", tone: "result" },
        ],
      },
      qa: {
        ...base, id: "qa", title: "헤드리스 검증", kicker: "DETERMINISTIC QA",
        description: "Unity 화면 없이 실제 wire protocol과 서버 상태 전이를 반복 가능한 시나리오로 검증합니다.",
        nodes: [
          node("qa-scenario", "시나리오 시작", "movement · combat · map", "qa", 68, "QA Tools", "결정론적 입력 순서와 기대 결과를 가진 smoke 시나리오를 시작합니다.", ["headless-bot", "scenario"], "intent"),
          node("bot-session", "BotSession", "실제 wire client", "qa", 292, "QA Tools", "봇이 테스트 전용 shortcut 없이 실제 패킷을 송수신합니다.", ["BotSession", "protocol client"]),
          node("qa-contract", "공유 패킷", "production contract", "contract", 516, "Shared", "제품과 동일한 패킷 ID와 직렬화 코드를 사용합니다.", ["GenPackets", "same contract"]),
          node("qa-transport", "서버 연결", "TCP + handshake", "transport", 740, "Server Network", "운영 경로와 동일한 listener/session 계층을 통과합니다.", ["Listener", "PacketSession"]),
          node("qa-runtime", "권위 로직", "tick · combat · migration", "server", 964, "Game Server", "실제 서버 상태 머신이 시나리오 입력을 처리합니다.", ["GameMap", "GameWorld"], "authority"),
          node("qa-events", "결과 수집", "packet event stream", "qa", 1188, "QA Tools", "hit, death, clear, transition 패킷을 이벤트로 수집합니다.", ["FightProbe", "StageClearEvent"], "result"),
          node("qa-assert", "회귀 판정", "count · state · ID", "qa", 1412, "QA Tools", "중복 억제, entity ID 유지, 최종 상태를 명시적으로 검증합니다.", ["assertion", "deterministic"], "result"),
        ],
        edges: [
          { from: "qa-scenario", to: "bot-session", label: "steps", tone: "intent" },
          { from: "bot-session", to: "qa-contract", label: "encode" },
          { from: "qa-contract", to: "qa-transport", label: "wire" },
          { from: "qa-transport", to: "qa-runtime", label: "dispatch" },
          { from: "qa-runtime", to: "qa-events", label: "packets", tone: "result" },
          { from: "qa-events", to: "qa-assert", label: "observe", tone: "result" },
        ],
      },
    };
  }

  function createClassAreas() {
    return {
      client: { id: "client", title: "클라이언트 영역", kicker: "UNITY + CLIENT NETWORK", layers: ["Unity Client", "Client Network"], description: "입력, 예측, 화면 표현, Unity 세션과 클라이언트 socket 계층의 핵심 타입입니다." },
      server: { id: "server", title: "서버 영역", kicker: "GAME SERVER + SERVER NETWORK", layers: ["Game Server", "Server Network"], description: "세션, handler, map actor, combat, migration과 서버 socket 계층의 핵심 타입입니다." },
      shared: { id: "shared", title: "공유 영역", kicker: "PROTOCOL + GAME DATA", layers: ["Shared"], description: "클라이언트와 서버가 함께 사용하는 패킷 계약, 열거형, 물리 및 게임 데이터 타입입니다." },
    };
  }

  function relationKinds(relations) {
    const counts = new Map();
    relations.forEach(relation => counts.set(relation.kind, (counts.get(relation.kind) || 0) + 1));
    return [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
  }

  function renderCallTree(rootId, direction) {
    const root = methodById.get(rootId);
    const children = root?.[direction] || [];
    if (!children.length) return empty(direction === "calls" ? "해석된 호출 대상이 없습니다." : "해석된 역호출자가 없습니다.");
    const branch = (methodId, depth, visited) => {
      const method = methodById.get(methodId);
      if (!method) return "";
      const owner = typeById.get(method.typeId);
      const cycle = visited.has(methodId);
      const nextVisited = new Set(visited); nextVisited.add(methodId);
      const next = cycle || depth >= 4 ? [] : method[direction];
      return `<li><button class="call-node" data-method-id="${attr(method.id)}"><b>${escapeHtml(owner?.name || "?")}.${escapeHtml(method.name)}</b><span>${escapeHtml(method.signature)}${cycle ? " · cycle" : ""}</span></button>${next.length ? `<ul>${next.slice(0, 12).map(id => branch(id, depth + 1, nextVisited)).join("")}</ul>` : ""}</li>`;
    };
    return `<ul class="call-tree">${children.slice(0, 16).map(id => branch(id, 1, new Set([rootId]))).join("")}</ul>`;
  }

  function relationItem(relation, direction) {
    const targetId = direction === "out" ? relation.targetId : relation.sourceId;
    const target = typeById.get(targetId);
    return `<div class="relation-item"><span class="relation-kind">${direction} ${escapeHtml(relation.kind)}</span><span>${escapeHtml(target?.name || targetId)}</span><button class="link-button" data-type-id="${attr(targetId)}">열기</button></div>`;
  }

  function contextRelation(relation, direction) {
    const targetId = direction === "out" ? relation.targetId : relation.sourceId;
    const target = typeById.get(targetId);
    return `<button data-type-id="${attr(targetId)}"><span class="relation-kind">${escapeHtml(relation.kind)}</span> ${escapeHtml(target?.name || targetId)}</button>`;
  }

  function methodItem(method) {
    return `<div class="method-item ${method.id === state.selectedMethodId ? "is-selected" : ""}" data-method-id="${attr(method.id)}"><div><div class="method-signature">${escapeHtml(method.signature)}</div><div class="method-meta">${method.sourceLines} lines · ${method.calls.length} calls · ${method.calledBy.length} callers</div></div><span class="relation-kind">trace</span></div>`;
  }

  function diagnosticCard(item) {
    return `<article class="diagnostic-card ${attr(item.severity)}"><div><span class="principle">${escapeHtml(item.principle)}</span><div class="badge ${attr(item.severity)}">${escapeHtml(item.severity)}</div></div><div><h3>${escapeHtml(item.typeName)} · ${escapeHtml(item.title)}</h3><p>${escapeHtml(item.evidence)}</p></div><button class="link-button" data-type-id="${attr(item.typeId)}">타입 보기</button></article>`;
  }

  function chip(label, dimension, value, current) {
    return `<button class="chip ${value === current ? "is-active" : ""}" data-${dimension}="${attr(value)}">${escapeHtml(label)}</button>`;
  }
  function stat(label, value, className = "") { return `<article class="stat-card ${className}"><strong>${number(value)}</strong><span>${label}</span></article>`; }
  function metric(label, value) { return `<div class="metric"><strong>${number(value)}</strong><span>${label}</span></div>`; }
  function flowNode(title, description) { return `<div class="flow-node"><b>${title}</b><span>${description}</span></div>`; }
  function badge(label, className = "") { return label ? `<span class="badge ${className}">${escapeHtml(label)}</span>` : ""; }
  function empty(message) { return `<div class="empty-state">${escapeHtml(message)}</div>`; }

  function pickInitialType() {
    return data.types.find(item => item.name === "GameMap" && !item.isTest)?.id ||
      data.types.find(item => !item.isTest && !item.isGenerated)?.id || data.types[0]?.id;
  }
  function relationEndpointVisible(typeId) {
    const type = typeById.get(typeId);
    if (!type) return false;
    if (!showGenerated.checked && type.isGenerated) return false;
    return true;
  }
  function displaySourceRoot(value) {
    const match = String(value).match(/^\/mnt\/([a-z])\/(.*)$/i);
    return match ? `${match[1].toUpperCase()}:/${match[2]}` : value;
  }
  function groupBy(items, keySelector) {
    const map = new Map();
    items.forEach(item => {
      const key = keySelector(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }
  function shortFolder(folder, layer) {
    const parts = folder.split("/");
    if (layer === "Unity Client") return parts.slice(3).join("/") || "Scripts";
    if (layer === "Game Server" || layer === "Server Tests") return parts.slice(2).join("/") || parts.at(-1);
    return parts.slice(1).join("/") || parts[0];
  }
  function formatDate(value) { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  function number(value) { return new Intl.NumberFormat("ko-KR").format(value); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
  function attr(value) { return escapeHtml(value); }
  function highlight(value, query) {
    const safe = escapeHtml(value);
    if (!query) return safe;
    const index = value.toLowerCase().indexOf(query);
    if (index < 0) return safe;
    return `${escapeHtml(value.slice(0, index))}<mark>${escapeHtml(value.slice(index, index + query.length))}</mark>${escapeHtml(value.slice(index + query.length))}`;
  }
})();
