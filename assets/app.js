(() => {
  "use strict";

  const data = window.ARCHITECTURE_DATA;
  const main = document.querySelector("#main-content");
  const tree = document.querySelector("#type-tree");
  const contextPanel = document.querySelector("#context-panel");
  const searchInput = document.querySelector("#search-input");
  const showGenerated = document.querySelector("#show-generated");
  const treeSummary = document.querySelector("#tree-summary");
  const sidebarToggle = document.querySelector("#sidebar-toggle");
  const contextToggle = document.querySelector("#context-toggle");
  const shell = document.querySelector(".app-shell");
  const sidebar = document.querySelector("#project-explorer");
  const context = document.querySelector("#context-panel");
  let sourceUmlRenderSeq = 0;

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
  const viewNames = new Set(["overview", "flow", "architecture", "classes", "source-uml", "explorer", "diagnostics", "calls"]);
  const state = {
    view: initialView(),
    selectedTypeId: pickInitialType(),
    selectedMethodId: null,
    search: "",
    diagnosticSeverity: "all",
    diagnosticPrinciple: "all",
    diagnosticTypeId: null,
    diagnosticCopyStatus: null,
    sourceUmlCopyStatus: null,
    architectureCopyStatus: null,
    sidebarCollapsed: readPanelPreference("atlas.sidebarCollapsed"),
    contextCollapsed: readPanelPreference("atlas.contextCollapsed"),
    layerFilter: null,
    flowScenario: "movement",
    flowSelectedNode: "input",
    flowPlaying: true,
    flowZoom: 1,
    architecturePlaying: true,
    architectureZoom: .75,
    classArea: "client",
    classSelectedTypeId: null,
    classRelationKind: "all",
    classZoom: 1,
    localRelationKind: "all",
    localRelationPage: 0,
  };

  document.querySelector("#generated-at").textContent =
    `${formatDate(data.generatedAtUtc)} · ${data.summary.files}개 파일`;

  bindEvents();
  syncPanelVisibility();
  syncTabs();
  renderTree();
  render();

  function bindEvents() {
    document.addEventListener("keydown", event => {
      if (event.key === "/" && document.activeElement !== searchInput) {
        event.preventDefault();
        if (state.sidebarCollapsed) {
          state.sidebarCollapsed = false;
          writePanelPreference("atlas.sidebarCollapsed", false);
          syncPanelVisibility();
        }
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
      button.addEventListener("click", () => {
        if (button.dataset.view === "diagnostics") state.diagnosticTypeId = null;
        setView(button.dataset.view);
      });
    });

    document.querySelector("#help-button").addEventListener("click", () =>
      document.querySelector("#help-dialog").showModal());
    document.querySelector("#help-close").addEventListener("click", () =>
      document.querySelector("#help-dialog").close());
    sidebarToggle.addEventListener("click", () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      writePanelPreference("atlas.sidebarCollapsed", state.sidebarCollapsed);
      syncPanelVisibility();
    });
    contextToggle.addEventListener("click", () => {
      state.contextCollapsed = !state.contextCollapsed;
      writePanelPreference("atlas.contextCollapsed", state.contextCollapsed);
      syncPanelVisibility();
    });

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
      state.diagnosticCopyStatus = null;
      render();
      return;
    }
    const principleTarget = event.target.closest("[data-principle]");
    if (principleTarget) {
      state.diagnosticPrinciple = principleTarget.dataset.principle;
      state.diagnosticCopyStatus = null;
      render();
      return;
    }
    const diagnosticTypeTarget = event.target.closest("[data-diagnostic-type]");
    if (diagnosticTypeTarget) {
      state.diagnosticTypeId = diagnosticTypeTarget.dataset.diagnosticType || null;
      state.diagnosticSeverity = "all";
      state.diagnosticPrinciple = "all";
      state.diagnosticCopyStatus = null;
      setView("diagnostics");
      return;
    }
    const copyDiagnosticsTarget = event.target.closest("[data-copy-diagnostics]");
    if (copyDiagnosticsTarget) {
      copyDiagnostics();
      render();
      return;
    }
    const copyArchitectureTarget = event.target.closest("[data-copy-architecture]");
    if (copyArchitectureTarget) {
      copyArchitectureSource();
      render();
      return;
    }
    const copySourceUmlTarget = event.target.closest("[data-copy-source-uml]");
    if (copySourceUmlTarget) {
      copySourceUml(copySourceUmlTarget.dataset.copySourceUml);
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
      state.flowZoom = nextZoom(state.flowZoom, Number(flowZoomTarget.dataset.flowZoom), 1);
      render();
      return;
    }
    const architectureZoomTarget = event.target.closest("[data-architecture-zoom]");
    if (architectureZoomTarget) {
      state.architectureZoom = nextZoom(state.architectureZoom, Number(architectureZoomTarget.dataset.architectureZoom), .75);
      render();
      return;
    }
    const architecturePlayTarget = event.target.closest("[data-architecture-play]");
    if (architecturePlayTarget) {
      state.architecturePlaying = !state.architecturePlaying;
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
    if (!viewNames.has(view)) return;
    state.view = view;
    history.replaceState(null, "", `#${view}`);
    syncTabs();
    render();
  }

  function syncPanelVisibility() {
    shell.classList.toggle("is-sidebar-collapsed", state.sidebarCollapsed);
    shell.classList.toggle("is-context-collapsed", state.contextCollapsed);
    syncPanelElement(sidebar, state.sidebarCollapsed);
    syncPanelElement(context, state.contextCollapsed);
    syncPanelToggle(sidebarToggle, state.sidebarCollapsed, "Project Explorer", "sidebar");
    syncPanelToggle(contextToggle, state.contextCollapsed, "설명", "context");
  }

  function syncPanelElement(element, collapsed) {
    element.setAttribute("aria-hidden", String(collapsed));
    element.inert = collapsed;
  }

  function syncPanelToggle(button, collapsed, label, side) {
    const action = collapsed ? "열기" : "접기";
    const icon = side === "sidebar"
      ? (collapsed ? "›" : "‹")
      : (collapsed ? "‹" : "›");
    button.setAttribute("aria-expanded", String(!collapsed));
    button.title = `${label} ${action}`;
    button.querySelector("[aria-hidden='true']").textContent = icon;
    button.querySelector(".sr-only").textContent = `${label} ${action}`;
  }

  function readPanelPreference(key) {
    try {
      return localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  }

  function writePanelPreference(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // file:// privacy settings may disable storage; the current session still works.
    }
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
    history.replaceState(null, "", "#explorer");
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
    history.replaceState(null, "", "#calls");
    syncTabs();
    renderTree();
    render();
  }

  function render() {
    if (state.view === "overview") renderOverview();
    else if (state.view === "flow") renderFlow();
    else if (state.view === "architecture") renderArchitectureMap();
    else if (state.view === "classes") renderClasses();
    else if (state.view === "source-uml") renderSourceUml();
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
              ${renderTreeKindGroups(folderTypes)}
            </details>`).join("")}
        </div>
      </details>`;
    }).join("") || `<div class="empty-state">검색 결과가 없습니다.</div>`;
  }

  function renderTreeKindGroups(types) {
    const groups = groupBy(types, type => type.kind);
    return [...groups.entries()]
      .sort(([a], [b]) => typeKindOrder(a) - typeKindOrder(b) || a.localeCompare(b))
      .map(([kind, kindTypes]) => `<div class="tree-kind-group">
        <div class="tree-kind-heading"><span>${escapeHtml(kind)}</span><span class="tree-count">${kindTypes.length}</span></div>
        ${kindTypes.sort((a, b) => a.name.localeCompare(b.name)).map(type => `
          <button class="tree-type ${type.id === state.selectedTypeId ? "is-selected" : ""}" data-type-id="${attr(type.id)}">
            <span class="kind-dot ${attr(type.kind)}"></span><span>${highlight(type.name, state.search)}</span>
          </button>`).join("")}
      </div>`).join("");
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
          <p class="subtitle">DawnHolder의 Server, Client, ClientNet, Shared, PacketGenerator를 하나의 탐색 지도에서 연결합니다.</p>
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
          ${flowNode("Client", "입력, 렌더링, prediction")}
          ${flowNode("ClientNet", "TCP 연결과 프레이밍")}
          ${flowNode("Shared", "패킷 계약과 게임 공식")}
          ${flowNode("Server", "검증, tick, 권위 상태")}
          ${flowNode("Tool", "패킷 계약 생성")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>전체 구조도</h2><button class="link-button" data-view-link="architecture">구조도 열기</button></div>
        <p class="muted">실행 영역, 생성 코드, 공유 계약, 신뢰 경계를 한 장의 high-level diagram으로 봅니다.</p>
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
    main.querySelector("[data-view-link='architecture']")?.addEventListener("click", () => setView("architecture"));
  }

  function renderArchitectureMap() {
    const model = createSystemArchitectureDiagram();
    const source = formatArchitectureSource();
    const copyLabel = state.architectureCopyStatus === "copied" ? "복사됨" : state.architectureCopyStatus === "failed" ? "복사 실패" : "구조도 원문 복사";
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const animate = state.architecturePlaying && !reducedMotion;
    main.innerHTML = `
      <header class="page-header">
        <div>
          <span class="eyebrow">HIGH-LEVEL ARCHITECTURE</span>
          <h1>전체 구조도</h1>
          <p class="subtitle">연결을 생성, 요청, 권위 처리, 결과 반환, 공유 계약의 다섯 의미 채널로 분리했습니다. 움직이는 배선 점은 방향을, 선 위 번호는 연결 목적을 보여줍니다.</p>
        </div>
        <div class="source-ref">Client · ClientNet · Shared · Server · Tool</div>
      </header>
      <section class="panel architecture-map-panel">
        <div class="diagram-heading">
          <div><span class="eyebrow">SYSTEM BOUNDARIES</span><h2>Runtime + Generation Structure</h2></div>
          <div class="diagram-heading-actions">
            <p>번호는 연결 의도를, 색과 움직이는 점은 관계 종류와 진행 방향을 나타냅니다.</p>
            <button class="ghost-button motion-toggle" data-architecture-play aria-pressed="${state.architecturePlaying}">${reducedMotion ? "모션 감소 설정 적용" : animate ? "배선 흐름 정지" : "배선 흐름 재생"}</button>
            ${zoomControls("architecture", state.architectureZoom, "전체 구조도")}
          </div>
        </div>
        <div class="architecture-map-scroll">${renderSystemArchitectureSvg(model, state.architectureZoom, animate)}</div>
        <div class="architecture-intent-strip" aria-label="구조도 연결 의도">
          ${model.channels.map(channel => `<div class="architecture-intent-item ${attr(channel.tone)}"><span>${channel.number}</span><div><b>${escapeHtml(channel.title)}</b><small>${escapeHtml(channel.detail)}</small></div></div>`).join("")}
        </div>
      </section>
      <details class="panel architecture-source-details">
        <summary><span><span class="eyebrow">MERMAID SOURCE</span><b>구조도 원문</b></span><span class="architecture-source-summary">열어서 보기</span></summary>
        <div class="architecture-source-actions"><p>외부 문서나 PR 설명에 사용할 수 있는 Mermaid flowchart 원문입니다.</p><button class="ghost-button" data-copy-architecture>${escapeHtml(copyLabel)}</button></div>
        <pre class="architecture-source"><code>${escapeHtml(source)}</code></pre>
      </details>`;
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
          ${zoomControls("flow", state.flowZoom, "전체 흐름도")}
          <button class="ghost-button motion-toggle" data-flow-play aria-pressed="${state.flowPlaying}">${reducedMotion ? "모션 감소 설정 적용" : animate ? "애니메이션 정지" : "애니메이션 재생"}</button>
        </div>
      </div>
      <section class="panel diagram-panel">
        <div class="diagram-heading"><div><span class="eyebrow">${escapeHtml(scenario.kicker)}</span><h2>${escapeHtml(scenario.title)}</h2></div><p>${escapeHtml(scenario.description)}</p></div>
        <div class="diagram-scroll">
          ${renderArchitectureDiagram(scenario, selectedNode.id, animate, state.flowZoom)}
        </div>
        <div class="flow-meaning-strip" aria-label="흐름 연결 의미">
          <div class="intent"><span>1</span><div><b>요청</b><small>Client가 행동 의도를 만듭니다.</small></div></div>
          <div class="data"><span>2</span><div><b>전달</b><small>계약과 네트워크 계층이 데이터를 전달합니다.</small></div></div>
          <div class="authority"><span>3</span><div><b>권위 처리</b><small>Server가 검증하고 상태를 확정합니다.</small></div></div>
          <div class="result"><span>4</span><div><b>확정 결과</b><small>서버 결과가 Client 표현에 반영됩니다.</small></div></div>
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

  function renderArchitectureDiagram(scenario, selectedNodeId, animate, zoom = 1) {
    const usedLaneIds = new Set(scenario.nodes.map(node => node.laneId));
    const usedLanes = scenario.lanes.filter(lane => usedLaneIds.has(lane.id))
      .map((lane, index) => ({ ...lane, y: 56 + index * 142, height: 126 }));
    const laneY = new Map(usedLanes.map(lane => [lane.id, lane.y]));
    const nodeWidth = 148;
    const nodeHeight = 64;
    const layoutNodes = scenario.nodes.map((node, index) => ({ ...node, x: 190 + index * 220, y: laneY.get(node.laneId) + 42 }));
    const nodeById = new Map(layoutNodes.map(node => [node.id, node]));
    const diagramHeight = Math.max(...usedLanes.map(lane => lane.y + lane.height)) + 18;
    const diagramWidth = Math.max(1260, layoutNodes.at(-1).x + nodeWidth + 38);
    const paths = scenario.edges.map((edge, index) => {
      const source = nodeById.get(edge.from);
      const target = nodeById.get(edge.to);
      const route = orthogonalPath(source, target, nodeWidth, nodeHeight);
      const edgeLabel = flowEdgeLabel(edge.label);
      const labelWidth = Math.max(48, edgeLabel.length * 7 + 18);
      return `<g class="diagram-connector ${attr(edge.tone || "data")}">
        <path d="${route.path}" marker-end="url(#arrow-${attr(edge.tone || "data")})"></path>
        <rect class="connector-label-bg" x="${route.labelX - labelWidth / 2}" y="${route.labelY - 10}" width="${labelWidth}" height="16" rx="4"></rect>
        <text x="${route.labelX}" y="${route.labelY + 1}">${escapeHtml(edgeLabel)}</text>
        ${animate ? `<circle r="4"><animateMotion dur="${flowAnimationDuration(route.path)}s" begin="${(index * .42).toFixed(2)}s" repeatCount="indefinite" path="${route.path}"></animateMotion></circle>` : ""}
      </g>`;
    }).join("");
    return `<svg class="architecture-diagram" style="${diagramZoomStyle(zoom)}" viewBox="0 0 ${diagramWidth} ${diagramHeight}" role="group" aria-label="${attr(scenario.title)}">
      <defs>
        <pattern id="diagram-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" class="diagram-grid-line"></path></pattern>
        ${["intent", "data", "authority", "result"].map(tone => `<marker id="arrow-${tone}" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><polygon points="0 0, 9 3.5, 0 7"></polygon></marker>`).join("")}
      </defs>
      <rect class="diagram-grid-bg" width="100%" height="100%"></rect>
      <text class="diagram-stage-heading" x="22" y="30">RESPONSIBILITY</text>
      ${layoutNodes.map((node, index) => `<g class="diagram-stage-marker ${node.id === selectedNodeId ? "is-selected" : ""}" transform="translate(${node.x + nodeWidth / 2} 24)"><circle r="11"></circle><text y="4">${index + 1}</text></g>`).join("")}
      ${usedLanes.map(lane => `<g class="diagram-lane ${attr(lane.id)}"><rect x="8" y="${lane.y}" width="${diagramWidth - 16}" height="${lane.height}"></rect><line x1="152" y1="${lane.y}" x2="152" y2="${lane.y + lane.height}"></line><text x="22" y="${lane.y + 28}">${escapeHtml(lane.title)}</text><text class="lane-caption" x="22" y="${lane.y + 48}">${escapeHtml(lane.caption)}</text></g>`).join("")}
      ${paths}
      ${layoutNodes.map((node, index) => `<g class="diagram-node ${node.id === selectedNodeId ? "is-selected" : ""} ${attr(node.tone || "data")}" data-flow-node="${attr(node.id)}" tabindex="0" role="button" aria-label="${index + 1}. ${attr(node.title)}" transform="translate(${node.x} ${node.y})">
        <rect width="${nodeWidth}" height="${nodeHeight}"></rect><circle cx="16" cy="16" r="10"></circle><text class="node-order" x="16" y="20">${index + 1}</text><text class="node-title" x="32" y="24">${escapeHtml(node.title)}</text><text class="node-subtitle" x="14" y="45">${escapeHtml(node.subtitle)}</text><text class="node-layer" x="14" y="58">${escapeHtml(node.layer)}</text>
      </g>`).join("")}
    </svg>`;
  }

  function orthogonalPath(source, target, nodeWidth = 176, nodeHeight = 72) {
    const startX = source.x + nodeWidth;
    const startY = source.y + nodeHeight / 2;
    const endX = target.x;
    const endY = target.y + nodeHeight / 2;
    const middleX = startX + Math.max(18, (endX - startX) / 2);
    return {
      path: `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`,
      labelX: middleX,
      labelY: source.y === target.y ? source.y - 12 : (startY + endY) / 2,
    };
  }

  function flowEdgeLabel(label) {
    const labels = {
      intent: "행동 의도",
      encode: "패킷 인코딩",
      bytes: "직렬화",
      "TCP frame": "TCP 전송",
      dispatch: "패킷 분배",
      enqueue: "작업 큐 등록",
      S_Snapshot: "확정 위치",
      submit: "작업 제출",
      tick: "tick 처리",
      mutate: "상태 변경",
      broadcast: "결과 전파",
      C_EnterPortal: "포털 요청",
      approved: "검증 통과",
      "map handoff": "맵 인계",
      result: "전환 결과",
      notify: "클라이언트 통지",
      read: "스키마 읽기",
      format: "템플릿 적용",
      emit: "코드 생성",
      consume: "계약 참조",
    };
    return labels[label] || label;
  }

  function createSystemArchitectureDiagram() {
    const zone = (id, title, subtitle, x, y, width, height, tone = "data") => ({ id, title, subtitle, x, y, width, height, tone });
    const zones = [
      zone("generation", "Generation", "99_Tools/PacketGenerator", 40, 72, 1120, 154, "tool"),
      zone("shared", "Shared Contract Bus", "98_Shared · 런타임 호출이 아닌 공통 계약", 40, 250, 1120, 146, "shared"),
      zone("client", "Client Device", "03_Client + 04_ClientNet", 40, 450, 516, 244, "client"),
      zone("server", "Server Host", "02_Server", 644, 450, 516, 244, "server"),
    ];
    const item = (id, zoneId, title, subtitle, x, y, width = 184, tone = "data") => ({ id, zoneId, title, subtitle, x, y, width, tone });
    const items = [
      item("pdl", "generation", "PDL.xml", "packet schema", 130, 144, 190, "intent"),
      item("generator", "generation", "PacketGenerator", "parse XML + emit C#", 505, 144, 190, "authority"),
      item("generated", "generation", "Generated Artifacts", "GenPackets + packet managers", 880, 144, 190, "result"),
      item("shared-rules", "shared", "Game Rules", "physics · stats · enums", 92, 322, 194),
      item("shared-packets", "shared", "Packet Contract", "PacketID · IPacket · DTO", 914, 322, 194, "result"),
      item("unity", "client", "Unity Client", "input · prediction · render", 64, 522, 174, "intent"),
      item("network-service", "client", "NetworkService", "session lifecycle", 340, 522, 174),
      item("client-net", "client", "ClientNet", "TCP frame · send buffer", 340, 616, 174),
      item("server-net", "server", "Server Network", "listener · packet session", 678, 616, 174),
      item("handlers", "server", "Handlers", "decode · validate · gate", 910, 616, 174, "authority"),
      item("world", "server", "GameWorld / Maps", "actor ownership", 678, 522, 174, "authority"),
      item("systems", "server", "Systems", "movement · combat", 910, 522, 174, "authority"),
    ];
    const channel = (number, title, detail, tone, badgeX, badgeY, paths, labels) => ({ number, title, detail, tone, badgeX, badgeY, paths, labels });
    const channels = [
      channel(1, "생성", "스키마에서 공통 패킷 코드와 양쪽 manager를 생성", "generation", 840, 171,
        ["M 320 171 H 505", "M 695 171 H 880"],
        [{ x: 412, y: 158, text: "스키마 정의" }, { x: 780, y: 158, text: "코드 생성" }]),
      channel(2, "요청", "Client intent를 프레이밍해 신뢰 경계를 넘어 전달", "intent", 600, 643,
        ["M 238 549 H 340", "M 427 576 V 616", "M 514 643 H 678", "M 852 643 H 910"],
        [{ x: 289, y: 536, text: "플레이어 입력" }, { x: 562, y: 630, text: "TCP 요청" }, { x: 881, y: 630, text: "패킷 분배" }]),
      channel(3, "권위 처리", "검증된 요청을 actor 소유 영역과 game system에서 확정", "authority", 997, 596,
        ["M 997 616 V 576", "M 910 549 H 852"],
        [{ x: 1062, y: 598, text: "작업 큐 등록" }, { x: 881, y: 536, text: "시스템 처리" }]),
      channel(4, "결과 반환", "서버 확정 결과를 네트워크 경로로 Client에 반영", "result", 700, 742,
        ["M 1084 549 H 1138 V 742 H 427 V 670", "M 340 643 H 142 V 576"],
        [{ x: 820, y: 729, text: "확정 상태 반환" }, { x: 236, y: 630, text: "화면 상태 반영" }]),
      channel(5, "공유 계약", "Client와 Server가 같은 규칙과 패킷 형태를 참조", "contract", 680, 349,
        ["M 286 349 H 914", "M 189 376 V 418 H 163 V 450", "M 1011 376 V 418 H 997 V 450"],
        [{ x: 600, y: 336, text: "공통 참조 버스" }, { x: 221, y: 410, text: "Client 참조" }, { x: 969, y: 410, text: "Server 참조" }]),
    ];
    return { zones, items, channels, width: 1200, height: 780 };
  }

  function renderSystemArchitectureSvg(model, zoom = 1, animate = false) {
    return `<svg class="architecture-map" style="${diagramZoomStyle(zoom)}" viewBox="0 0 ${model.width} ${model.height}" role="img" aria-label="DawnHolder high level architecture">
      <defs>
        ${["generation", "intent", "authority", "result"].map(tone => `<marker id="arch-arrow-${tone}" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><polygon points="0 0, 9 3.5, 0 7"></polygon></marker>`).join("")}
      </defs>
      <rect class="architecture-map-bg" width="100%" height="100%"></rect>
      <text class="architecture-map-title" x="40" y="38">DawnHolder High-Level Architecture</text>
      <text class="architecture-map-caption" x="1160" y="38" text-anchor="end">선 번호 = 연결 의도</text>
      <text class="trust-boundary-label" x="600" y="436" text-anchor="middle">CLIENT / SERVER TRUST BOUNDARY</text>
      <line class="trust-boundary-line" x1="600" y1="444" x2="600" y2="702"></line>
      ${model.zones.map(zone => `<g class="architecture-zone ${attr(zone.tone)}">
        <rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" rx="8"></rect>
        <line class="zone-header-divider" x1="${zone.x}" y1="${zone.y + 62}" x2="${zone.x + zone.width}" y2="${zone.y + 62}"></line>
        <text class="zone-title" x="${zone.x + 18}" y="${zone.y + 30}">${escapeHtml(zone.title)}</text>
        <text class="zone-subtitle" x="${zone.x + 18}" y="${zone.y + 49}">${escapeHtml(zone.subtitle)}</text>
      </g>`).join("")}
      ${model.channels.map(channel => `<g class="architecture-channel ${attr(channel.tone)}">
        ${channel.paths.map(path => `<path class="channel-route" d="${path}" ${channel.tone === "contract" ? "" : `marker-end="url(#arch-arrow-${attr(channel.tone)})"`}></path>`).join("")}
        ${animate ? channel.paths.map((path, index) => `<circle class="channel-flow-dot" r="${channel.tone === "contract" ? "3.2" : "4.4"}"><animateMotion dur="${flowAnimationDuration(path)}s" begin="${(index * .34 + channel.number * .16).toFixed(2)}s" repeatCount="indefinite" path="${path}"></animateMotion></circle>`).join("") : ""}
        ${channel.labels.map(label => `<g class="channel-label" transform="translate(${label.x} ${label.y})"><rect x="${-Math.max(26, label.text.length * 5.5)}" y="-11" width="${Math.max(52, label.text.length * 11)}" height="18" rx="4"></rect><text y="2">${escapeHtml(label.text)}</text></g>`).join("")}
        <g class="channel-badge" transform="translate(${channel.badgeX} ${channel.badgeY})"><circle r="11"></circle><text y="4">${channel.number}</text></g>
      </g>`).join("")}
      ${model.items.map(item => `<g class="architecture-component ${attr(item.tone)}" transform="translate(${item.x} ${item.y})">
        <rect width="${item.width}" height="54" rx="6"></rect>
        <text class="component-title" x="14" y="22">${escapeHtml(item.title)}</text>
        <text class="component-subtitle" x="14" y="40">${escapeHtml(item.subtitle)}</text>
      </g>`).join("")}
    </svg>`;
  }

  function flowAnimationDuration(path) {
    const points = [...path.matchAll(/[MLHV]\s*(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/g)];
    let x = 0, y = 0, length = 0;
    points.forEach(match => {
      const command = match[0][0];
      const first = Number(match[1]);
      const second = match[2] === undefined ? null : Number(match[2]);
      const nextX = command === "V" ? x : first;
      const nextY = command === "H" ? y : second ?? y;
      if (command !== "M") length += Math.abs(nextX - x) + Math.abs(nextY - y);
      x = nextX;
      y = nextY;
    });
    return Math.min(8, Math.max(1.8, length / 105)).toFixed(2);
  }

  function formatArchitectureSource() {
    const lines = [
      "flowchart LR",
      "  subgraph Tool",
      "    PDL[PDL.xml]",
      "    PG[PacketGenerator]",
      "  end",
      "  subgraph Shared",
      "    GP[GenPackets.cs]",
      "    Contract[Packet Contract]",
      "  end",
      "  subgraph ClientNet",
      "    CN[ClientPacketManager / TCP Frame]",
      "  end",
      "  subgraph Client",
      "    Input[Input + Prediction]",
      "    Render[Reconcile / UI / Scene Load]",
      "  end",
      "  subgraph Server",
      "    SM[ServerPacketManager]",
      "    Authority[Validate + Tick + Migration]",
      "  end",
      "",
      "  PDL -->|1 생성| PG --> GP",
      "  PG -.-> CN",
      "  PG -.-> SM",
      "  Input -->|2 요청| CN --> SM",
      "  SM -->|3 권위 처리| Authority",
      "  Authority -->|4 결과 반환| Render",
      "  Contract -.->|5 공유 계약| Input",
      "  Contract -.-> Authority",
    ];
    return lines.join("\n");
  }

  function copyArchitectureSource() {
    copyText(formatArchitectureSource()).then(
      () => {
        state.architectureCopyStatus = "copied";
        render();
      },
      () => {
        state.architectureCopyStatus = "failed";
        render();
      },
    );
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
    const kinds = relationKinds(allRelations);
    const selectedRelations = relations
      .filter(relation => relation.sourceId === selected?.id || relation.targetId === selected?.id)
      .sort((a, b) => classRelationKindOrder(a.kind) - classRelationKindOrder(b.kind)
        || classRelationOtherName(a, selected?.id).localeCompare(classRelationOtherName(b, selected?.id)));

    main.innerHTML = `
      <header class="page-header">
        <div><span class="eyebrow">CLASS DIAGRAM</span><h1>영역별 클래스 맵</h1><p class="subtitle">선택한 타입을 중심으로 바로 연결된 클래스만 표시합니다. 들어오는 관계와 나가는 관계를 분리하고, 관계 유형별 직교 배선으로 흐름을 정리합니다.</p></div>
        <div class="source-ref">${areaTypes.length} types · ${allRelations.length} internal relations</div>
      </header>
      <div class="class-toolbar">
        <div class="scenario-tabs" aria-label="클래스 영역">
          ${Object.values(classAreas).map(item => `<button class="chip ${item.id === area.id ? "is-active" : ""}" data-class-area="${attr(item.id)}">${escapeHtml(item.title)}</button>`).join("")}
        </div>
        <div class="diagram-actions">
          <div class="zoom-controls" aria-label="클래스 다이어그램 확대 축소"><button class="ghost-button" data-class-zoom="-.1" aria-label="축소">−</button><span>${Math.round(state.classZoom * 100)}%</span><button class="ghost-button" data-class-zoom=".1" aria-label="확대">+</button></div>
        </div>
      </div>
      <div class="class-kind-toolbar" aria-label="클래스 관계 종류">
        ${chip("전체 관계", "class-kind", "all", state.classRelationKind)}
        ${kinds.map(kind => chip(`${kind.kind} ${kind.count}`, "class-kind", kind.kind, state.classRelationKind)).join("")}
      </div>
      <section class="panel diagram-panel">
        <div class="diagram-heading"><div><span class="eyebrow">${escapeHtml(area.kicker)}</span><h2>${escapeHtml(area.title)}</h2></div><p>${escapeHtml(area.description)}</p></div>
        <div class="diagram-scroll">${renderClassDiagram(selected, selectedRelations, state.classZoom)}</div>
      </section>
      <div class="flow-detail-grid">
        <section class="panel selected-step-panel">
          <span class="eyebrow">SELECTED TYPE</span><h2>${escapeHtml(selected?.name || "선택 없음")}</h2>
          ${selected ? `<p>${escapeHtml(selected.fullName)}</p><div class="badge-row">${badge(selected.kind, "accent")}${badge(selected.layer)}${badge(`${selected.methodCount} methods`)}${badge(`fan ${selected.fanIn}/${selected.fanOut}`)}</div><button class="link-button class-open-button" data-type-id="${attr(selected.id)}">구조 탐색에서 열기</button>` : ""}
        </section>
        <section class="panel">
          <div class="panel-header"><h2>선택 타입 관계</h2><span class="muted">${selectedRelations.length} relations</span></div>
          <div class="class-relation-groups">${renderClassRelationGroups(selectedRelations, selected?.id)}</div>
        </section>
      </div>`;
  }

  function renderClassDiagram(selected, relations, zoom) {
    if (!selected) return empty("표시할 타입이 없습니다.");
    const layout = buildLocalClassLayout(selected, relations);
    const { nodes, bundles, width, height } = layout;
    return `<svg class="class-diagram" style="width:${Math.round(width * zoom)}px" viewBox="0 0 ${width} ${height}" role="group" aria-label="${attr(selected.name)} 직접 관계 클래스 다이어그램">
      <defs>
        <pattern id="class-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" class="diagram-grid-line"></path></pattern>
        ${["inherits", "implements", "uses", "creates", "calls"].map(kind => `<marker id="class-arrow-${kind}" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 Z"></path></marker>`).join("")}
      </defs>
      <rect class="diagram-grid-bg" width="100%" height="100%"></rect>
      <text class="class-column-heading" x="48" y="34">INCOMING</text>
      <text class="class-column-heading center" x="${width / 2}" y="34">SELECTED TYPE</text>
      <text class="class-column-heading end" x="${width - 48}" y="34">OUTGOING</text>
      <g class="class-edges">${bundles.map(classRelationBundle).join("")}</g>
      ${nodes.map(classTypeNode).join("")}
    </svg>`;
  }

  function buildLocalClassLayout(selected, relations) {
    const width = 1220, nodeWidth = 250, nodeHeight = 66, gapY = 20, top = 66;
    const incoming = classRelationNodes(relations, selected.id, "in");
    const outgoing = classRelationNodes(relations, selected.id, "out");
    const rows = Math.max(incoming.length, outgoing.length, 1);
    const height = Math.max(300, top + rows * (nodeHeight + gapY) + 26);
    const selectedNode = { type: selected, x: (width - nodeWidth) / 2, y: (height - nodeHeight) / 2, width: nodeWidth, height: nodeHeight, selected: true };
    const place = (items, x) => items.map((item, index) => ({ ...item, x, y: top + index * (nodeHeight + gapY), width: nodeWidth, height: nodeHeight }));
    const incomingNodes = place(incoming, 48);
    const outgoingNodes = place(outgoing, width - nodeWidth - 48);
    const nodeByKey = new Map([...incomingNodes, ...outgoingNodes].map(node => [`${node.direction}:${node.type.id}`, node]));
    const bundles = buildClassRelationBundles(relations, selected, selectedNode, nodeByKey);
    return { nodes: [...incomingNodes, selectedNode, ...outgoingNodes], bundles, width, height };
  }

  function classRelationKindOrder(kind) {
    return ({ inherits: 0, implements: 1, creates: 2, calls: 3, uses: 4 }[kind] ?? 9);
  }

  function classRelationNodes(relations, selectedTypeId, direction) {
    const grouped = new Map();
    relations.filter(relation => direction === "in" ? relation.targetId === selectedTypeId : relation.sourceId === selectedTypeId).forEach(relation => {
      const otherId = direction === "in" ? relation.sourceId : relation.targetId;
      const item = grouped.get(otherId) || { type: typeById.get(otherId), direction, kinds: new Set() };
      item.kinds.add(relation.kind);
      grouped.set(otherId, item);
    });
    return [...grouped.values()].filter(item => item.type).sort((a, b) =>
      Math.min(...[...a.kinds].map(classRelationKindOrder)) - Math.min(...[...b.kinds].map(classRelationKindOrder))
      || a.type.name.localeCompare(b.type.name));
  }

  function buildClassRelationBundles(relations, selected, selectedNode, nodeByKey) {
    const groups = groupBy(relations, relation => `${relation.targetId === selected.id ? "in" : "out"}:${relation.kind}`);
    return [...groups.entries()].map(([key, items]) => {
      const [direction, kind] = key.split(":");
      const kindIndex = classRelationKindOrder(kind);
      const busX = direction === "in"
        ? selectedNode.x - 38 - kindIndex * 24
        : selectedNode.x + selectedNode.width + 38 + kindIndex * 24;
      const selectedY = selectedNode.y + 20 + kindIndex * 7;
      const branches = items.map(relation => {
        const otherId = direction === "in" ? relation.sourceId : relation.targetId;
        const node = nodeByKey.get(`${direction}:${otherId}`);
        if (!node) return null;
        const kinds = [...node.kinds].sort((a, b) => classRelationKindOrder(a) - classRelationKindOrder(b));
        const portOffset = (kinds.indexOf(kind) - (kinds.length - 1) / 2) * 8;
        return { node, y: node.y + node.height / 2 + portOffset };
      }).filter(Boolean);
      const ys = [selectedY, ...branches.map(branch => branch.y)];
      return {
        direction,
        kind,
        busX,
        selectedX: direction === "in" ? selectedNode.x : selectedNode.x + selectedNode.width,
        selectedY,
        branches,
        top: Math.min(...ys),
        bottom: Math.max(...ys),
      };
    }).sort((a, b) => a.direction.localeCompare(b.direction) || classRelationKindOrder(a.kind) - classRelationKindOrder(b.kind));
  }

  function classRelationBundle(bundle) {
    const trunkMarker = bundle.direction === "in" ? ` marker-end="url(#class-arrow-${attr(bundle.kind)})"` : "";
    const branches = bundle.branches.map(branch => {
      const nodeX = bundle.direction === "in" ? branch.node.x + branch.node.width : branch.node.x;
      const marker = bundle.direction === "out" ? ` marker-end="url(#class-arrow-${attr(bundle.kind)})"` : "";
      return `<path class="class-relation-branch" d="M ${bundle.busX} ${branch.y} H ${nodeX}"${marker}></path><circle cx="${bundle.busX}" cy="${branch.y}" r="2.5"></circle>`;
    }).join("");
    const labelX = (bundle.busX + bundle.selectedX) / 2;
    return `<g class="class-relation-edge ${attr(bundle.kind)} ${bundle.direction}">
      <path class="class-relation-bus" d="M ${bundle.busX} ${bundle.top} V ${bundle.bottom}"></path>
      <path class="class-relation-trunk" d="M ${bundle.direction === "in" ? bundle.busX : bundle.selectedX} ${bundle.selectedY} H ${bundle.direction === "in" ? bundle.selectedX : bundle.busX}"${trunkMarker}></path>
      ${branches}
      <text x="${labelX}" y="${bundle.selectedY - 8}">${escapeHtml(bundle.kind)}</text>
    </g>`;
  }

  function classTypeNode(node) {
    const type = node.type;
    const kindSummary = node.selected ? "focus" : [...node.kinds].sort((a, b) => classRelationKindOrder(a) - classRelationKindOrder(b)).join(" · ");
    return `<g class="class-type-node ${node.selected ? "is-selected" : ""} ${attr(type.kind)}" transform="translate(${node.x} ${node.y})" data-class-type-id="${attr(type.id)}" tabindex="0" role="button" aria-label="${attr(type.name)}">
      <rect width="${node.width}" height="${node.height}" rx="5"></rect>
      <line x1="0" y1="25" x2="${node.width}" y2="25"></line>
      <text class="class-type-stereotype" x="12" y="17">${escapeHtml(type.kind)}</text>
      <text class="class-type-name" x="12" y="43">${escapeHtml(truncate(type.name, 29))}</text>
      <text class="class-type-meta" x="12" y="57">${escapeHtml(truncate(type.namespace || type.folder || type.layer, 38))}</text>
      <text class="class-type-kinds" x="${node.width - 12}" y="17">${escapeHtml(kindSummary)}</text>
    </g>`;
  }

  function renderClassRelationGroups(relations, selectedTypeId) {
    if (!relations.length) return empty("선택한 조건의 직접 관계가 없습니다.");
    const groups = groupBy(relations, relation => relation.kind);
    return [...groups.entries()].sort(([a], [b]) => classRelationKindOrder(a) - classRelationKindOrder(b)).map(([kind, items]) => `
      <section class="class-relation-group ${attr(kind)}">
        <header><span class="class-relation-swatch"></span><b>${escapeHtml(kind)}</b><small>${items.length}</small></header>
        <div class="class-relation-list">${items.map(relation => classRelationItem(relation, selectedTypeId)).join("")}</div>
      </section>`).join("");
  }

  function classRelationItem(relation, selectedTypeId) {
    const outgoing = relation.sourceId === selectedTypeId;
    const other = typeById.get(outgoing ? relation.targetId : relation.sourceId);
    return `<button class="class-relation-item" data-class-type-id="${attr(other?.id || "")}"><span>${outgoing ? "OUT" : "IN"}</span><small>${escapeHtml(other?.name || "Unknown")}</small><em>${escapeHtml(other?.kind || "type")}</em></button>`;
  }

  function classRelationOtherName(relation, selectedTypeId) {
    return typeById.get(relation.sourceId === selectedTypeId ? relation.targetId : relation.sourceId)?.name || "";
  }

  function classTypeScore(type) { return type ? type.fanIn + type.fanOut + type.methodCount * .25 : 0; }
  function truncate(value, length) { return value.length > length ? `${value.slice(0, length - 1)}…` : value; }

  function renderSourceUml() {
    const model = sourceUmlModel();
    const copyLabel = state.sourceUmlCopyStatus === "all" ? "복사됨" : state.sourceUmlCopyStatus === "failed" ? "복사 실패" : "전체 Mermaid 복사";
    main.innerHTML = `
      <header class="page-header">
        <div>
          <span class="eyebrow">SOURCE-BACKED UML</span>
          <h1>C# 소스 기준 클래스 다이어그램</h1>
          <p class="subtitle">지정된 <code>C:\\Dev\\ClaudeDev</code> 경로의 C# 파일만 근거로 작성했습니다. Mermaid classDiagram 코드이며, 추론 관계와 템플릿 내부 생성 코드는 별도 확인 목록으로 분리했습니다.</p>
        </div>
        <div class="source-ref">02_Server/GameServer · 02_Server/Network · PacketGenerator PDL</div>
      </header>
      <section class="panel source-scope-panel">
        <div>
          <span class="eyebrow">INCLUDED</span>
          <p>GameServer의 Combat, Handlers, Loop, Maps, Network와 Server Network, PacketGenerator의 PDL 생성기 타입.</p>
        </div>
        <div>
          <span class="eyebrow">EXCLUDED</span>
          <p>GameServer.Tests, Bot/BgmComposer, bin/obj, PacketFormat 문자열 템플릿 안의 생성 예정 타입.</p>
        </div>
        <button class="ghost-button" data-copy-source-uml="all">${escapeHtml(copyLabel)}</button>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>발견 타입 / 관계 목록</h2><span class="muted">${model.rows.length} grouped entries</span></div>
        <div class="source-uml-table">
          ${model.rows.map(row => `<div class="source-uml-row">
            <span>${escapeHtml(row.area)}</span>
            <b>${escapeHtml(row.type)}</b>
            <small>${escapeHtml(row.surface)}</small>
            <em>${escapeHtml(row.relation)}</em>
          </div>`).join("")}
        </div>
      </section>
      <div class="source-uml-grid">
        ${model.diagrams.map((diagram, index) => `<section class="panel source-uml-card">
          <div class="panel-header">
            <div><span class="eyebrow">${escapeHtml(diagram.group)}</span><h2>${escapeHtml(diagram.title)}</h2></div>
            <button class="ghost-button" data-copy-source-uml="${attr(diagram.id)}">${state.sourceUmlCopyStatus === diagram.id ? "복사됨" : "복사"}</button>
          </div>
          <div class="source-uml-render" data-source-uml-index="${index}"><div class="source-uml-loading">Mermaid 렌더링 중</div></div>
          <details class="mermaid-details">
            <summary>Mermaid 코드</summary>
            <pre class="mermaid-code"><code>${escapeHtml(diagram.code)}</code></pre>
          </details>
        </section>`).join("")}
      </div>
      <section class="panel">
        <div class="panel-header"><h2>근거가 약한 관계 / 제외</h2><span class="muted">not drawn</span></div>
        <div class="source-uml-table">
          ${model.weak.map(item => `<div class="source-uml-row weak"><span>${escapeHtml(item.item)}</span><small>${escapeHtml(item.reason)}</small></div>`).join("")}
        </div>
      </section>`;
    renderSourceMermaidDiagrams(model);
  }

  function renderSourceMermaidDiagrams(model) {
    const targets = main.querySelectorAll("[data-source-uml-index]");
    if (!window.mermaid) {
      targets.forEach(target => { target.innerHTML = `<div class="empty-state">Mermaid 엔진을 불러오지 못했습니다.</div>`; });
      return;
    }
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      themeVariables: {
        background: "#080b0f",
        mainBkg: "#151c25",
        primaryColor: "#151c25",
        primaryBorderColor: "#506075",
        primaryTextColor: "#e7edf4",
        lineColor: "#9aa8b8",
        textColor: "#e7edf4",
        fontFamily: "Inter, Pretendard, Noto Sans KR, system-ui, sans-serif",
      },
      class: {
        hideEmptyMembersBox: false,
      },
    });
    targets.forEach(async target => {
      const diagram = model.diagrams[Number(target.dataset.sourceUmlIndex)];
      if (!diagram) return;
      try {
        const renderId = `source-uml-mermaid-${diagram.id}-${++sourceUmlRenderSeq}`;
        const result = await window.mermaid.render(renderId, diagram.code);
        target.innerHTML = result.svg;
        const svg = target.querySelector("svg");
        if (svg) {
          svg.removeAttribute("height");
          svg.classList.add("source-uml-mermaid-svg");
        }
      } catch (error) {
        target.innerHTML = `<div class="empty-state">Mermaid 렌더링 실패: ${escapeHtml(error.message || error)}</div>`;
      }
    });
  }

  function copySourceUml(id) {
    const model = sourceUmlModel();
    const text = id === "all"
      ? formatSourceUmlText(model)
      : model.diagrams.find(item => item.id === id)?.code || "";
    copyText(text).then(
      () => { state.sourceUmlCopyStatus = id || "all"; setTimeout(() => { state.sourceUmlCopyStatus = null; render(); }, 1300); },
      () => { state.sourceUmlCopyStatus = "failed"; setTimeout(() => { state.sourceUmlCopyStatus = null; render(); }, 1800); });
  }

  function formatSourceUmlText(model) {
    return [
      "# C# Source UML",
      "",
      "## 발견 타입 / 관계 목록",
      ...model.rows.map(row => `- ${row.area} / ${row.type}: ${row.relation}`),
      "",
      ...model.diagrams.flatMap(diagram => [`## ${diagram.title}`, "```mermaid", diagram.code, "```", ""]),
      "## 근거가 약한 관계 / 제외",
      ...model.weak.map(item => `- ${item.item}: ${item.reason}`),
    ].join("\n");
  }

  function renderSourceUmlDiagram(diagram) {
    const parsed = parseMermaidClassDiagram(diagram.code);
    const nodeWidth = 222;
    const gapX = parsed.direction === "LR" ? 76 : 42;
    const gapY = parsed.direction === "LR" ? 46 : 64;
    const columns = parsed.direction === "LR" ? Math.min(4, Math.max(2, Math.ceil(parsed.classes.length / 2))) : Math.min(3, Math.max(1, parsed.classes.length));
    let nodes = parsed.classes.map((item, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const height = Math.max(72, 54 + Math.min(item.members.length, 5) * 15);
      return {
        ...item,
        x: 36 + column * (nodeWidth + gapX),
        y: 34 + row * (height + gapY),
        width: nodeWidth,
        height,
        row,
        column,
      };
    });
    const rows = Math.max(1, Math.ceil(nodes.length / columns));
    const rowHeights = Array.from({ length: rows }, (_, row) =>
      Math.max(...nodes.filter(item => item.row === row).map(item => item.height), 72));
    nodes.forEach(item => {
      item.y = 34 + rowHeights.slice(0, item.row).reduce((sum, height) => sum + height + gapY, 0);
    });
    let width = Math.max(520, 72 + columns * nodeWidth + (columns - 1) * gapX);
    let height = Math.max(250, 68 + rowHeights.reduce((sum, item) => sum + item, 0) + (rows - 1) * gapY);
    const preset = sourceUmlPresetLayout(diagram.id, nodes);
    if (preset) {
      nodes = preset.nodes;
      width = preset.width;
      height = preset.height;
    }
    const nodeByName = new Map(nodes.map(item => [item.name, item]));
    const edges = parsed.relations.map((relation, index) => {
      const source = nodeByName.get(relation.source);
      const target = nodeByName.get(relation.target);
      if (!source || !target) return "";
      const route = sourceUmlEdgeRoute(source, target, parsed.direction, index, diagram.id);
      return `<g class="source-uml-edge ${attr(sourceUmlRelationClass(relation.kind))}">
        <path d="${route.path}" ${sourceUmlMarkerAttrs(relation.kind)}></path>
        <text x="${route.labelX}" y="${route.labelY}">${escapeHtml(sourceUmlRelationLabel(relation.kind, relation.label))}</text>
      </g>`;
    }).join("");
    return `<svg class="source-uml-svg" style="width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="${attr(diagram.title)} rendered UML">
      <defs>
        <marker id="source-uml-triangle" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto"><path d="M 1 1 L 11 5 L 1 9 Z"></path></marker>
        <marker id="source-uml-diamond" markerWidth="14" markerHeight="10" refX="2" refY="5" orient="auto"><path d="M 2 5 L 7 1 L 12 5 L 7 9 Z"></path></marker>
        <marker id="source-uml-hollow-diamond" markerWidth="14" markerHeight="10" refX="2" refY="5" orient="auto"><path d="M 2 5 L 7 1 L 12 5 L 7 9 Z"></path></marker>
      </defs>
      <rect class="source-uml-bg" width="100%" height="100%"></rect>
      <g class="source-uml-edges">${edges}</g>
      ${nodes.map(node => sourceUmlNode(node)).join("")}
    </svg>`;
  }

  function sourceUmlPresetLayout(diagramId, nodes) {
    if (diagramId !== "overview") return null;
    const positions = {
      Handlers: [36, 154],
      GameServerNetwork: [354, 154],
      Loop: [440, 32],
      Maps: [852, 105],
      Combat: [1232, 105],
      ServerNetwork: [812, 296],
      PacketGenerator: [370, 306],
    };
    const laidOut = nodes.map(node => {
      const [x, y] = positions[node.name] || [node.x, node.y];
      return { ...node, x, y, width: node.name === "GameServerNetwork" ? 220 : 150, height: 70, overview: true };
    });
    return { nodes: laidOut, width: 1420, height: 455 };
  }

  function parseMermaidClassDiagram(code) {
    const classes = new Map();
    const relations = [];
    let direction = "TB";
    let current = null;
    code.split(/\r?\n/).forEach(rawLine => {
      const line = rawLine.trim();
      if (!line || line === "classDiagram") return;
      const directionMatch = line.match(/^direction\s+(LR|TB)$/);
      if (directionMatch) {
        direction = directionMatch[1];
        return;
      }
      const relationMatch = line.match(/^(.+?)\s+(--\|>|\.\.\|>|\*--|o--|\.\.>)\s+(.+?)(?:\s*:\s*(.+))?$/);
      if (relationMatch) {
        const [, source, kind, target, label] = relationMatch;
        relations.push({ source: source.trim(), kind, target: target.trim(), label: label || "" });
        ensureSourceUmlClass(classes, source.trim());
        ensureSourceUmlClass(classes, target.trim());
        return;
      }
      const inlineClassMatch = line.match(/^class\s+([^\s{]+)\s*\{\s*(.*?)\s*\}$/);
      if (inlineClassMatch) {
        const item = ensureSourceUmlClass(classes, inlineClassMatch[1]);
        if (inlineClassMatch[2]) item.members.push(inlineClassMatch[2]);
        current = null;
        return;
      }
      const classMatch = line.match(/^class\s+([^\s{]+)(?:\s*\{)?$/);
      if (classMatch) {
        current = ensureSourceUmlClass(classes, classMatch[1]);
        if (!line.endsWith("{")) current = null;
        return;
      }
      if (line === "}") {
        current = null;
        return;
      }
      if (current) {
        current.members.push(line);
      }
    });
    return { direction, classes: [...classes.values()], relations };
  }

  function ensureSourceUmlClass(classes, name) {
    if (!classes.has(name)) classes.set(name, { name, members: [] });
    return classes.get(name);
  }

  function sourceUmlEdgeRoute(source, target, direction, index, diagramId = "") {
    if (diagramId === "overview") return sourceUmlOverviewEdgeRoute(source, target);
    const offset = ((index % 5) - 2) * 7;
    if (direction === "LR") {
      const sourceX = source.x + source.width;
      const targetX = target.x;
      const sourceY = source.y + source.height / 2;
      const targetY = target.y + target.height / 2;
      const midX = (sourceX + targetX) / 2 + offset;
      return {
        path: `M ${sourceX} ${sourceY} H ${midX} V ${targetY} H ${targetX}`,
        labelX: midX,
        labelY: (sourceY + targetY) / 2 - 7,
      };
    }
    const sourceX = source.x + source.width / 2;
    const targetX = target.x + target.width / 2;
    const sourceY = source.y + source.height;
    const targetY = target.y;
    const midY = (sourceY + targetY) / 2 + offset;
    return {
      path: `M ${sourceX} ${sourceY} V ${midY} H ${targetX} V ${targetY}`,
      labelX: (sourceX + targetX) / 2,
      labelY: midY - 7,
    };
  }

  function sourceUmlOverviewEdgeRoute(source, target) {
    const sourceCenterY = source.y + source.height / 2;
    const targetCenterY = target.y + target.height / 2;
    const sourceCenterX = source.x + source.width / 2;
    const targetCenterX = target.x + target.width / 2;
    const sourceRight = source.x + source.width;
    const targetLeft = target.x;
    const targetRight = target.x + target.width;
    if (source.name === "Loop" && target.name === "Maps") {
      return { path: `M ${sourceRight} ${sourceCenterY} C 600 58, 715 78, ${targetLeft} ${targetCenterY}`, labelX: 645, labelY: 80 };
    }
    if (source.name === "Maps" && target.name === "Combat") {
      return { path: `M ${source.x + source.width} ${sourceCenterY} H ${target.x}`, labelX: 1050, labelY: sourceCenterY - 10 };
    }
    if (source.name === "GameServerNetwork" && target.name === "Maps") {
      return { path: `M ${sourceRight} ${sourceCenterY - 12} C 600 138, 695 122, ${targetLeft} ${targetCenterY - 4}`, labelX: 670, labelY: 128 };
    }
    if (source.name === "Maps" && target.name === "GameServerNetwork") {
      return { path: `M ${targetLeft} ${targetCenterY + 8} C 690 206, 595 201, ${sourceRight} ${sourceCenterY + 14}`, labelX: 695, labelY: 202 };
    }
    if (source.name === "GameServerNetwork" && target.name === "ServerNetwork") {
      return { path: `M ${sourceRight - 2} ${source.y + source.height} L ${target.x + 18} ${target.y}`, labelX: 642, labelY: 294 };
    }
    if (source.name === "PacketGenerator" && target.name === "ServerNetwork") {
      return { path: `M ${source.x + source.width} ${sourceCenterY} L ${target.x} ${targetCenterY}`, labelX: 650, labelY: 372 };
    }
    return {
      path: `M ${sourceRight} ${sourceCenterY} H ${(sourceRight + targetLeft) / 2} V ${targetCenterY} H ${targetLeft}`,
      labelX: (sourceCenterX + targetCenterX) / 2,
      labelY: (sourceCenterY + targetCenterY) / 2 - 8,
    };
  }

  function sourceUmlNode(node) {
    const members = node.members.slice(0, 5);
    const stereotype = members.find(item => item.startsWith("<<"));
    const visibleMembers = members.filter(item => !item.startsWith("<<"));
    return `<g class="source-uml-node ${node.overview ? "is-overview" : ""}" transform="translate(${node.x} ${node.y})">
      <rect width="${node.width}" height="${node.height}" rx="5"></rect>
      <line x1="0" y1="35" x2="${node.width}" y2="35"></line>
      <text class="source-uml-title" x="12" y="${stereotype ? 18 : 24}">${escapeHtml(truncate(node.name, 32))}</text>
      ${stereotype ? `<text class="source-uml-stereotype" x="12" y="31">${escapeHtml(stereotype)}</text>` : ""}
      ${visibleMembers.map((member, index) => `<text class="source-uml-member" x="12" y="${53 + index * 15}">${escapeHtml(truncate(member, 36))}</text>`).join("")}
    </g>`;
  }

  function sourceUmlRelationClass(kind) {
    return ({ "--|>": "extends", "..|>": "implements", "*--": "composition", "o--": "aggregation", "..>": "dependency" }[kind] || "dependency");
  }

  function sourceUmlMarkerAttrs(kind) {
    if (kind === "--|>" || kind === "..|>") return `marker-end="url(#source-uml-triangle)"`;
    if (kind === "*--") return `marker-start="url(#source-uml-diamond)"`;
    if (kind === "o--") return `marker-start="url(#source-uml-hollow-diamond)"`;
    return "";
  }

  function sourceUmlRelationLabel(kind, label) {
    const symbol = ({ "--|>": "상속", "..|>": "구현", "*--": "합성", "o--": "집약", "..>": "의존" }[kind] || "관계");
    return label ? `${symbol} · ${label}` : symbol;
  }

  function sourceUmlModel() {
    return {
      rows: [
        { area: "Combat", type: "EnemyEntity, AABB, EnemyState, CombatConstants", surface: "공개 combat state/value API", relation: "EnemyEntity *-- AABB, EnemyEntity o-- EnemyState" },
        { area: "Handlers", type: "IPacketHandler + concrete handlers", surface: "Handle(GameSession, ArraySegment<byte>)", relation: "handlers ..|> IPacketHandler, HandlerRegistry o-- IPacketHandler" },
        { area: "Loop", type: "GameWorld, TickScheduler, TickMetrics, Stats", surface: "world/tick lifecycle", relation: "GameWorld *-- GameMap, GameWorld *-- TickScheduler, TickMetrics *-- Stats" },
        { area: "Maps", type: "GameMap, PlayerEntity, Portal, systems", surface: "map actor, players, enemies, portal table", relation: "GameMap *-- PlayerEntity/EnemyEntity/systems, PlayerEntity *-- InputCommand" },
        { area: "Maps/States", type: "ActorState<T>, StateMachine<T>, player/enemy/boss states", surface: "state enter/tick/exit API", relation: "state classes --|> ActorState<T>, StateMachine *-- ActorState" },
        { area: "GameServer Network", type: "GameSession, IntentRateLimiter, MapMigration", surface: "session lifecycle and map migration hooks", relation: "GameSession --|> PacketSession, GameSession *-- IntentRateLimiter" },
        { area: "02_Server/Network", type: "Session, PacketSession, Listener, Connector, buffers, queues", surface: "socket/session/buffer primitives", relation: "PacketSession --|> Session, JobQueue ..|> IJobQueue" },
        { area: "PacketGenerator", type: "Program, PacketFormat", surface: "PDL parse methods and format strings", relation: "Program ..> PacketFormat" },
      ],
      diagrams: [
        diagram("overview", "Overview", "폴더 간 개요", String.raw`classDiagram
direction LR
class Combat
class Handlers
class Loop
class Maps
class GameServerNetwork
class ServerNetwork
class PacketGenerator

GameServerNetwork --|> ServerNetwork : GameSession -> PacketSession
Handlers ..> GameServerNetwork : Handle(GameSession)
Loop *-- Maps : GameWorld owns GameMap
Maps *-- Combat : GameMap owns EnemyEntity
Maps ..> GameServerNetwork : PlayerEntity Owner / Broadcast
GameServerNetwork ..> Maps : GetMap / migration
PacketGenerator ..> ServerNetwork : template references PacketSession`),
        diagram("combat", "Combat", "Combat", String.raw`classDiagram
direction TB
class CombatConstants {
  +float AttackRange
  +float AttackRangeSquared
  +float AttackHalfExtent
  +int BaseDamage
  +long AttackCooldownMs
  +int AnimLatchTicks
  +int BossBaseDamage
}
class EnemyState {
  <<enum>>
}
class AABB {
  +Vector2 Center
  +Vector2 HalfExtent
  +AABB(Vector2 center, Vector2 halfExtent)
  +bool Contains(Vector2 point)
  +bool Intersects(AABB other)
}
class EnemyEntity {
  +int EntityId
  +EnemyKind Kind
  +float X
  +float Y
  +int Hp
  +int MaxHp
  +bool IsDead
  +EnemyStats Stats
  +AABB Hitbox
  +EnemyState State
  +void EnterHitState(float dirX)
}
EnemyEntity *-- AABB : Hitbox
EnemyEntity o-- EnemyState : State`),
        diagram("handlers", "Handlers", "Handlers", String.raw`classDiagram
direction TB
class IPacketHandler {
  <<interface>>
  +Handle(GameSession session, ArraySegment~byte~ buffer)
}
class AttackHandler { +void Handle(GameSession session, ArraySegment~byte~ buffer) }
class CharacterSelectHandler { +void Handle(GameSession session, ArraySegment~byte~ buffer) }
class EnterPortalHandler { +void Handle(GameSession session, ArraySegment~byte~ buffer) }
class HandshakeHandler { +void Handle(GameSession session, ArraySegment~byte~ buffer) }
class MoveIntentHandler { +void Handle(GameSession session, ArraySegment~byte~ buffer) }
class PingHandler { +void Handle(GameSession session, ArraySegment~byte~ buffer) }
class HandlerRegistry {
  +bool TryGet(PacketID id, out IPacketHandler handler)
}
AttackHandler ..|> IPacketHandler
CharacterSelectHandler ..|> IPacketHandler
EnterPortalHandler ..|> IPacketHandler
HandshakeHandler ..|> IPacketHandler
MoveIntentHandler ..|> IPacketHandler
PingHandler ..|> IPacketHandler
HandlerRegistry o-- IPacketHandler : registry`),
        diagram("loop", "Loop", "Loop", String.raw`classDiagram
direction TB
class GameWorld {
  +GameWorld Instance
  +int NextEntityId()
  +GameMap Map
  +long CurrentTick
  +TickScheduler Scheduler
  +GameWorld(IReadOnlyDictionary provider)
  +void Start()
  +void Stop()
  +GameMap? GetMap(MapId id)
}
class TickScheduler {
  +long CurrentTick
  +event Action~TickMetrics.Stats~ OnMetricsSnapshot
  +TickScheduler(Action~long~ onTick)
  +void Start()
  +void Stop()
}
class TickMetrics {
  +int BucketSize
  +void Record(long elapsedMicros)
  +bool IsBucketFull
  +int Count
  +Stats SnapshotAndReset()
  +Stats Compute()
}
class Stats {
  <<record struct>>
  +Stats Empty
  +string Format()
}
GameWorld *-- TickScheduler : _scheduler
GameWorld *-- GameMap : _maps
TickMetrics *-- Stats : snapshot`),
        diagram("maps-core", "Maps Core / Systems", "Maps", String.raw`classDiagram
direction TB
class GameMap {
  +IReadOnlyList~PlayerEntity~ Players
  +IReadOnlyDictionary~int, EnemyEntity~ Enemies
  +bool IsStageCleared
  +MapId MapId
  +IReadOnlyList~Portal~ Portals
  +PlayerEntity AddPlayer(GameSession? owner, Vector2 spawnPos, PlayerStats? stats)
  +bool RemovePlayer(int entityId)
  +PlayerEntity? GetPlayer(int entityId)
  +void BroadcastToAll(ArraySegment~byte~ payload, GameSession? except)
  +void Tick(long tickNumber)
}
class PlayerEntity {
  +int EntityId
  +Vector2 Position
  +GameSession? Owner
  +PlayerStats Stats
  +Vector2 Velocity
  +bool OnGround
  +void EnqueueInput(sbyte inputX, bool jumpPressed, uint clientTick)
  +bool TryDequeueInput(out InputCommand cmd)
  +void EnterAttackState()
  +void EnterHitState(float dirX)
  +void Revive()
}
class InputCommand {
  <<readonly struct>>
  +sbyte InputX
  +bool JumpPressed
  +uint ClientTick
}
class Portal {
  <<record>>
}
class PortalTable {
  +IReadOnlyList~Portal~ GetPortalsFor(MapId mapId)
}
class MapId {
  <<enum>>
}
class CombatSystem
class EnemyAISystem
class BossBehaviorSystem
class RespawnSystem
GameMap *-- PlayerEntity : _players
GameMap *-- EnemyEntity : _enemies
GameMap o-- Portal : Portals
GameMap *-- CombatSystem
GameMap *-- EnemyAISystem
GameMap *-- BossBehaviorSystem
GameMap *-- RespawnSystem
PlayerEntity *-- InputCommand : input queue
PortalTable ..> Portal : returns`),
        diagram("player-states", "Maps / Player States", "Maps", String.raw`classDiagram
direction TB
class ActorState~TActor~ {
  +AnimState AnimState
  +bool LocksMovement
  +bool InterruptibleByHit
  +void Enter(TActor actor)
  +ActorState~TActor~? Tick(TActor actor)
  +void Exit(TActor actor)
}
class StateMachine~TActor~ {
  +ActorState~TActor~ CurrentState
  +AnimState AnimState
  +void ChangeState(ActorState~TActor~ next, TActor actor)
  +void Tick(TActor actor)
}
class PlayerMovementStates
class PlayerCombatStates
class IdleState
class MoveState
class JumpState
class AttackState
class HitState
class DeathState
IdleState --|> ActorState~PlayerEntity~
MoveState --|> ActorState~PlayerEntity~
JumpState --|> ActorState~PlayerEntity~
AttackState --|> ActorState~PlayerEntity~
HitState --|> ActorState~PlayerEntity~
DeathState --|> ActorState~PlayerEntity~
StateMachine~PlayerEntity~ *-- ActorState~PlayerEntity~ : _current
PlayerMovementStates *-- IdleState
PlayerMovementStates *-- MoveState
PlayerMovementStates *-- JumpState
PlayerCombatStates *-- AttackState
PlayerCombatStates *-- HitState
PlayerCombatStates *-- DeathState`),
        diagram("enemy-states", "Maps / Enemy & Boss States", "Maps", String.raw`classDiagram
direction TB
class ActorState~TActor~ {
  +AnimState AnimState
  +bool LocksMovement
  +bool InterruptibleByHit
  +void Enter(TActor actor)
  +ActorState~TActor~? Tick(TActor actor)
  +void Exit(TActor actor)
}
class EnemyStates
class BossStates
class PatrolState
class ChaseState
class EnemyHitState
class BossIdleState
class BossMoveState
class BossTelegraphState
class BossAttackState
PatrolState --|> ActorState~EnemyEntity~
ChaseState --|> ActorState~EnemyEntity~
EnemyHitState --|> ActorState~EnemyEntity~
BossIdleState --|> ActorState~EnemyEntity~
BossMoveState --|> ActorState~EnemyEntity~
BossTelegraphState --|> ActorState~EnemyEntity~
BossAttackState --|> ActorState~EnemyEntity~
EnemyStates *-- PatrolState
EnemyStates *-- ChaseState
EnemyStates *-- EnemyHitState
BossStates *-- BossIdleState
BossStates *-- BossMoveState
BossStates *-- BossTelegraphState
BossStates *-- BossAttackState`),
        diagram("gameserver-network", "GameServer Network", "Network", String.raw`classDiagram
direction TB
class PacketSession {
  +int HeaderSize
  +int PacketIdSize
  +int MinFrameSize
  +int MaxFrameSize
  +int OnRecv(ArraySegment~byte~ buffer)
  +void OnRecvPacket(ArraySegment~byte~ buffer)
}
class GameSession {
  #bool HasSelectedClass
  #void SetCharacterClass(byte characterClass)
  #GameMap? GetMap()
  #GameMap? GetDestMap(MapId destMapId)
  +void OnConnected(EndPoint endPoint)
  #void EnterGameWorld()
  #void CompleteHandshakeAndEnter()
  #void EnterGameWorldIfReady()
  +void OnDisconnected(EndPoint endPoint)
  +void OnSend(int numOfBytes)
  +void OnRecvPacket(ArraySegment~byte~ buffer)
}
class IntentRateLimiter {
  +int LimitPerSecond
  +bool TryConsume(out bool firstWarn)
}
class MapMigration {
  +void Execute(...)
}
GameSession --|> PacketSession
GameSession *-- IntentRateLimiter : _rateLimiter
MapMigration ..> GameSession : migration hooks
MapMigration ..> GameMap : source/destination maps`),
        diagram("server-network", "02_Server/Network", "ServerNetwork", String.raw`classDiagram
direction TB
class Session {
  #Socket? _socket
  #int _disconnected
  #object _lock
  #Queue~ArraySegment~byte~~ _sendQueue
  +void OnConnected(EndPoint endPoint)
  +void OnDisconnected(EndPoint endPoint)
  +int OnRecv(ArraySegment~byte~ buffer)
  +void OnSend(int numOfBytes)
  +void Start(Socket socket)
  +void Send(ArraySegment~byte~ sendBuff)
  +void Send(List~ArraySegment~byte~~ sendBuffList)
  +void Disconnect()
}
class PacketSession {
  +int OnRecv(ArraySegment~byte~ buffer)
  +void OnRecvPacket(ArraySegment~byte~ buffer)
}
class Listener {
  +void Init(IPEndPoint endPoint, Func~Session~ sessionFactory, int register = 10)
  +Socket Accept()
}
class Connector {
  +void Connect(IPEndPoint endPoint, Func~Session~ sessionFactory, int count = 1)
}
class RecvBuffer
class SendBuffer
class SendBufferHelper
class IJobQueue { +void Push(Action job) }
class JobQueue { +void Push(Action job) }
class FrameValidator { +bool TryValidateFrameHeader(ushort dataSize, out string? reason) }
PacketSession --|> Session
Session *-- RecvBuffer : _recvBuffer
Listener o-- Session : factory
Connector o-- Session : factory
SendBufferHelper *-- SendBuffer : current
JobQueue ..|> IJobQueue`),
        diagram("packet-generator", "PacketGenerator / PDL", "Tool", String.raw`classDiagram
direction TB
class Program {
  +void ParsePacket(XmlReader r)
  +Tuple~string,string,string~ ParseMembers(XmlReader r)
  +Tuple~string,string,string~ ParseList(XmlReader r)
  +string ToMemberType(string memberType)
  +string FirstCharToUpper(string s)
  +string FirstCharToLower(string s)
}
class PacketFormat {
  +string managerFormat
  +string mangerRegisterFormat
  +string fileFormat
  +string packetEnumFormat
  +string packetFormat
  +string MemberFormat
  +string MemberListFormat
  +string ReadFormat
  +string WriteFormat
}
Program ..> PacketFormat : string templates`),
      ],
      weak: [
        { item: "PacketFormat.cs 내부 PacketManager/IPacket/PacketID", reason: "실제 타입 선언이 아니라 문자열 템플릿 안의 생성 예정 코드라 제외했습니다." },
        { item: "Handler -> GameMap/Packet 세부 관계", reason: "Handle 내부 decode/call 기반의 transitive 의존이라 UML 관계선에서 생략했습니다." },
        { item: "TickScheduler -> TickMetrics", reason: "필드 보유가 아니라 RunLoop local 생성이므로 합성으로 그리지 않았습니다." },
        { item: "Shared 타입들", reason: "PlayerStats, EnemyStats, PacketID 등은 대상 경로 밖이라 타입 박스에서 제외했습니다." },
        { item: "PortalTable -> Portal", reason: "정적 반환 관계라 약한 dependency로만 표시했습니다." },
      ],
    };
  }

  function diagram(id, group, title, code) {
    return { id, group, title, code };
  }

  function renderExplorer() {
    const type = typeById.get(state.selectedTypeId) || data.types[0];
    if (!type) { main.innerHTML = empty("표시할 타입이 없습니다."); return; }
    const diagnostics = diagnosticsByType.get(type.id) || [];
    const methods = [...(methodsByType.get(type.id) || [])].sort((a, b) => a.name.localeCompare(b.name) || a.signature.localeCompare(b.signature));
    const fields = type.members.filter(member => member.kind === "field").sort((a, b) => a.name.localeCompare(b.name));
    const outgoing = sortLocalRelations((outgoingByType.get(type.id) || []).filter(relation => relationEndpointVisible(relation.targetId)), "out");
    const incoming = sortLocalRelations((incomingByType.get(type.id) || []).filter(relation => relationEndpointVisible(relation.sourceId)), "in");
    main.innerHTML = `
      <header class="page-header">
        <div>
          <span class="eyebrow">${escapeHtml(type.layer)} / ${escapeHtml(type.kind.toUpperCase())}</span>
          <h1>${escapeHtml(type.name)}</h1>
          <p class="subtitle">${escapeHtml(type.fullName)}</p>
          <div class="badge-row">
            ${type.patterns.map(pattern => badge(pattern, "accent")).join("")}
            ${type.responsibilities.map(item => badge(item)).join("")}
            ${diagnostics.length ? badge(`${diagnostics.length}개 검토 신호`, diagnostics.some(item => item.severity === "high") ? "high" : "medium") : ""}
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
        <section class="panel explorer-dependencies">
          <div class="panel-header"><h2>의존 관계</h2><span class="muted">out ${outgoing.length} / in ${incoming.length}</span></div>
          <div class="relation-list">
            ${incoming.slice(0, 8).map(relation => relationItem(relation, "in")).join("")}
            ${outgoing.slice(0, 12).map(relation => relationItem(relation, "out")).join("")}
            ${outgoing.length + incoming.length ? "" : empty("프로젝트 내부 관계가 없습니다.")}
          </div>
        </section>
      </div>
      <div class="detail-grid">
        <section class="panel">
          <div class="panel-header"><h2>메서드</h2><span class="muted">클릭하면 호출 탐색</span></div>
          <div class="method-access-groups">${renderMethodAccessGroups(methods)}</div>
        </section>
        <section class="panel">
          <div class="panel-header"><h2>필드</h2><span class="muted">${fields.length} fields</span></div>
          <div class="member-list">${fields.slice(0, 30).map(member => `<div class="member-item"><span class="relation-kind">${escapeHtml(member.modifiers.join(" ") || "unknown")}</span><span class="method-signature">${escapeHtml(member.type)} ${escapeHtml(member.name)}</span></div>`).join("") || empty("필드가 없습니다.")}</div>
          <div class="diagnostic-summary">
            <div><span class="eyebrow">REVIEW SIGNALS</span><strong>${diagnostics.length}개</strong><p>${diagnostics.length ? [...new Set(diagnostics.map(item => item.principle))].join(" · ") : "현재 타입에 연결된 검토 신호가 없습니다."}</p></div>
            <button class="ghost-button" data-diagnostic-type="${attr(type.id)}">진단 탭 열기</button>
          </div>
        </section>
      </div>`;
  }

  function renderMethodAccessGroups(methods) {
    const labels = [
      ["public", "public"],
      ["protected-internal", "protected / internal"],
      ["private", "private"],
      ["unknown", "unknown"],
    ];
    const groups = groupBy(methods, methodAccessGroup);
    return labels.map(([key, label]) => {
      const items = groups.get(key) || [];
      return `<section class="method-access-group"><header><span>${label}</span><small>${items.length}</small></header><div class="method-list">${items.map(methodItem).join("") || empty("해당 접근 수준의 메서드가 없습니다.")}</div></section>`;
    }).join("");
  }

  function methodAccessGroup(method) {
    const modifiers = new Set(method.modifiers || []);
    if (modifiers.has("public")) return "public";
    if (modifiers.has("protected") || modifiers.has("internal")) return "protected-internal";
    if (modifiers.has("private")) return "private";
    return "unknown";
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
    const contextType = typeById.get(state.diagnosticTypeId);
    const filtered = data.diagnostics.filter(item =>
      (!contextType || item.typeId === contextType.id) &&
      (state.diagnosticSeverity === "all" || item.severity === state.diagnosticSeverity) &&
      (state.diagnosticPrinciple === "all" || item.principle === state.diagnosticPrinciple));
    const copyLabel = state.diagnosticCopyStatus === "copied" ? "복사됨" : state.diagnosticCopyStatus === "failed" ? "복사 실패" : "텍스트로 복사";
    main.innerHTML = `
      <header class="page-header"><div><span class="eyebrow">DESIGN REVIEW</span><h1>SOLID와 결합도 신호</h1><p class="subtitle">자동 판정이 아닌 검토 목록입니다. 클래스가 실제로 몇 가지 이유로 변경되는지, 추상화가 이해 비용을 줄이는지 확인하세요.</p></div><div class="source-ref">${filtered.length} signals</div></header>
      ${contextType ? `<div class="diagnostic-context"><div><span class="eyebrow">TYPE CONTEXT</span><strong>${escapeHtml(contextType.name)}</strong><span>${escapeHtml(contextType.fullName)}</span></div><button class="ghost-button" data-diagnostic-type="">전체 타입 보기</button></div>` : ""}
      <div class="diagnostic-actions">
        <button class="ghost-button" data-copy-diagnostics ${filtered.length ? "" : "disabled"}>${escapeHtml(copyLabel)}</button>
        <span class="copy-status ${state.diagnosticCopyStatus === "failed" ? "is-error" : ""}">${escapeHtml(diagnosticCopyMessage(filtered.length))}</span>
      </div>
      <div class="diagnostic-toolbar">
        ${chip("전체 심각도", "severity", "all", state.diagnosticSeverity)}${chip("높음", "severity", "high", state.diagnosticSeverity)}${chip("중간", "severity", "medium", state.diagnosticSeverity)}
      </div>
      <div class="diagnostic-toolbar">
        ${chip("전체 원칙", "principle", "all", state.diagnosticPrinciple)}${principles.map(value => chip(value, "principle", value, state.diagnosticPrinciple)).join("")}
      </div>
      <section class="diagnostic-list">${filtered.map(diagnosticCard).join("") || empty("조건에 맞는 진단이 없습니다.")}</section>`;
  }

  function currentDiagnostics() {
    return data.diagnostics.filter(item =>
      (!state.diagnosticTypeId || item.typeId === state.diagnosticTypeId) &&
      (state.diagnosticSeverity === "all" || item.severity === state.diagnosticSeverity) &&
      (state.diagnosticPrinciple === "all" || item.principle === state.diagnosticPrinciple));
  }

  function copyDiagnostics() {
    const text = formatDiagnosticsText(currentDiagnostics());
    if (!text) return;
    copyText(text).then(
      () => {
        state.diagnosticCopyStatus = "copied";
        render();
      },
      () => {
        state.diagnosticCopyStatus = "failed";
        render();
      },
    );
  }

  function formatDiagnosticsText(items) {
    if (!items.length) return "";
    const severity = state.diagnosticSeverity === "all" ? "전체 심각도" : state.diagnosticSeverity;
    const principle = state.diagnosticPrinciple === "all" ? "전체 원칙" : state.diagnosticPrinciple;
    const lines = [
      `DawnHolder Architecture Atlas SOLID diagnostics`,
      `Filters: ${severity} / ${principle}`,
      `Count: ${items.length}`,
      "",
    ];
    items.forEach((item, index) => {
      lines.push(`${index + 1}. [${item.severity}] ${item.principle} - ${item.typeName}: ${item.title}`);
      lines.push(`   Evidence: ${item.evidence}`);
      lines.push(`   Location: ${item.file}:${item.line}`);
      lines.push("");
    });
    return lines.join("\n").trimEnd();
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy failed");
  }

  function diagnosticCopyMessage(count) {
    if (state.diagnosticCopyStatus === "copied") return `${count}개 진단을 클립보드에 복사했습니다.`;
    if (state.diagnosticCopyStatus === "failed") return "브라우저가 클립보드 쓰기를 막았습니다.";
    return "현재 필터 결과를 리뷰용 텍스트로 복사합니다.";
  }

  function renderContext() {
    if (state.view === "architecture") {
      contextPanel.innerHTML = `
        <section class="context-card"><span class="eyebrow">ARCHITECTURE MAP</span><h3>전체 구조도</h3><p>Client, ClientNet, Shared, Server, Tool을 책임 경계로 나누고 연결 목적을 다섯 채널로 고정했습니다.</p></section>
        <section class="context-card"><h3>연결 의도</h3><p><b>1 생성</b> 스키마에서 코드를 만듭니다.</p><p><b>2 요청</b> Client 의도가 Server로 이동합니다.</p><p><b>3 권위 처리</b> Server가 상태를 확정합니다.</p><p><b>4 결과 반환</b> 확정 결과가 Client에 반영됩니다.</p><p><b>5 공유 계약</b> 양쪽이 같은 규칙과 형태를 참조합니다.</p></section>
        <section class="context-card"><h3>경계 읽기</h3><p>붉은 점선은 Client와 Server 사이 신뢰 경계입니다. 공유 계약의 회색 점선은 호출 순서가 아니라 정적 참조 관계입니다.</p></section>
        <section class="context-card"><h3>구조도 원문</h3><p>아래 원문은 외부 문서나 PR 설명에 붙여 넣을 수 있는 Mermaid flowchart입니다.</p></section>`;
      return;
    }
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
    const diagnosticPrinciples = [...new Set(diagnostics.map(item => item.principle))];
    contextPanel.innerHTML = `
      <section class="context-card"><span class="eyebrow">PINNED TYPE</span><h3>${escapeHtml(type.name)}</h3><p>${escapeHtml(type.file)}:${type.startLine}</p><div class="badge-row">${badge(type.kind)}${badge(type.layer, "accent")}</div></section>
      ${method ? `<section class="context-card"><span class="eyebrow">PINNED METHOD</span><h3>${escapeHtml(method.name)}</h3><p>${escapeHtml(method.signature)}</p><button class="link-button" data-method-id="${attr(method.id)}">호출 트리 열기</button></section>` : ""}
      <section class="context-card"><h3>나가는 관계</h3><div class="context-list">${outgoing.slice(0, 9).map(relation => contextRelation(relation, "out")).join("") || `<p>없음</p>`}</div></section>
      <section class="context-card"><h3>들어오는 관계</h3><div class="context-list">${incoming.slice(0, 9).map(relation => contextRelation(relation, "in")).join("") || `<p>없음</p>`}</div></section>
      <section class="context-card"><h3>검토 신호 요약</h3><p>${diagnostics.length ? `${diagnostics.length}개 · ${escapeHtml(diagnosticPrinciples.join(" · "))}` : "현재 신호 없음"}</p><button class="link-button" data-diagnostic-type="${attr(type.id)}">진단 탭에서 확인</button></section>`;
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

  function sortLocalRelations(relations, direction) {
    return [...relations].sort((a, b) => {
      const aType = typeById.get(direction === "out" ? a.targetId : a.sourceId);
      const bType = typeById.get(direction === "out" ? b.targetId : b.sourceId);
      return a.kind.localeCompare(b.kind)
        || typeKindOrder(aType?.kind) - typeKindOrder(bType?.kind)
        || (aType?.name || "").localeCompare(bType?.name || "");
    });
  }

  function typeKindOrder(kind) {
    return ({ interface: 0, class: 1, record: 2, struct: 3, "record-struct": 4, enum: 5 }[kind] ?? 9);
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
      { id: "client", title: "Client", caption: "입력 · 예측 · 표현", y: 16, height: 108 },
      { id: "transport", title: "ClientNet", caption: "TCP 연결 · 패킷 프레이밍", y: 136, height: 108 },
      { id: "contract", title: "Shared Contract", caption: "패킷 · ID · 게임 데이터", y: 256, height: 108 },
      { id: "server", title: "Server", caption: "검증 · tick · 상태 변경", y: 376, height: 108 },
      { id: "tool", title: "Tool", caption: "PacketGenerator · 코드 생성", y: 496, height: 108 },
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
          node("input", "입력 감지", "Input → intent", "client", 68, "Client", "플레이어 입력을 위치가 아닌 이동 의도로 변환합니다.", ["Input", "intent"], "intent"),
          node("predict", "로컬 예측", "즉시 화면 반영", "client", 270, "Client", "본인 캐릭터만 선반영해 입력 지연을 숨깁니다.", ["prediction", "local only"], "intent"),
          node("move-packet", "C_MoveIntent", "tick + input bits", "contract", 472, "Shared", "공유 패킷 계약에 tick과 입력 비트를 기록합니다.", ["packet", "append-only ID"]),
          node("client-send", "클라 프레이밍", "length-prefixed TCP", "transport", 674, "ClientNet", "ClientNet이 패킷을 frame으로 만들고 TCP로 전송합니다.", ["ClientSession", "SendBuffer"]),
          node("server-recv", "서버 수신", "frame → handler", "transport", 876, "Server", "서버 socket 계층이 frame을 복원해 게임 세션으로 넘깁니다.", ["PacketSession", "Session"]),
          node("move-validate", "입력 검증", "범위 · 충돌 · 속도", "server", 1078, "Server", "서버가 클라이언트 위치를 신뢰하지 않고 이동 가능성을 검증합니다.", ["MoveIntentHandler", "trust boundary"], "authority"),
          node("tick", "Tick 확정", "20 TPS state update", "server", 1280, "Server", "tick thread에서 권위 위치를 확정하고 snapshot을 만듭니다.", ["GameMap", "S_Snapshot"], "authority"),
          node("reconcile", "재조정", "snapshot 비교 · 보간", "client", 1482, "Client", "서버 snapshot과 예측 결과를 비교해 snap 또는 보간합니다.", ["reconciliation", "render"], "result"),
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
          node("attack-input", "공격 입력", "target 선택", "client", 68, "Client", "클라이언트는 대상 ID를 선택하지만 피해량은 결정하지 않습니다.", ["AttackIntent", "target only"], "intent"),
          node("attack-packet", "C_Attack", "target + client tick", "contract", 270, "Shared", "공격 의도를 공유 wire 계약으로 직렬화합니다.", ["C_Attack", "ProtocolVersion"]),
          node("attack-send", "패킷 전송", "TCP framing", "transport", 472, "ClientNet / Server", "분리된 양쪽 socket 계층이 동일 패킷 바이트를 전달합니다.", ["ClientNet", "Server"]),
          node("attack-handler", "AttackHandler", "decode only", "server", 674, "Server", "handler는 decode와 세션 게이트만 수행하고 상태를 직접 변경하지 않습니다.", ["IPacketHandler", "decode-only"], "authority"),
          node("attack-queue", "Map Job Queue", "tick thread handoff", "server", 876, "Server", "공격 작업을 해당 맵 actor의 tick thread로 전달합니다.", ["GameMap.EnqueueJob", "no await"], "authority"),
          node("attack-validate", "6단계 검증", "range · alive · rate", "server", 1078, "Server", "서버 위치를 기준으로 공격 가능성과 중복 요청을 검증합니다.", ["ProcessAttack", "trust boundary"], "authority"),
          node("combat-result", "상태 확정", "HP · death · clear", "server", 1280, "Server", "HP mutation 뒤 hit, death, stage clear 이벤트를 순서대로 만듭니다.", ["S_HitResult", "S_EntityDeath", "S_StageClear"], "authority"),
          node("combat-render", "결과 표현", "effect · UI · despawn", "client", 1482, "Client", "서버 결과를 받아 피해 효과, 사망, 스테이지 UI를 갱신합니다.", ["DamageFlash", "StageClear UI"], "result"),
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
          node("portal-input", "포털 진입", "portalId intent", "client", 68, "Client", "목적지 좌표가 아니라 portalId만 서버에 제안합니다.", ["C_EnterPortal", "no position"], "intent"),
          node("portal-send", "전환 요청", "session 유지", "transport", 270, "ClientNet", "기존 TCP 세션을 유지한 채 전환 패킷을 전송합니다.", ["NetworkService", "persistent session"]),
          node("portal-handler", "Portal Handler", "gate + submit", "server", 472, "Server", "handshake와 class 상태를 확인하고 현재 맵에 작업을 넣습니다.", ["EnterPortalHandler", "SubmitEnterPortal"], "authority"),
          node("portal-validate", "포털 검증", "ID · 거리 · 상태", "server", 674, "Server", "현재 위치와 portal table을 기준으로 전환 가능성을 검증합니다.", ["PortalTable", "distance <= 2"], "authority"),
          node("remove-map", "Map A 제거", "leave broadcast", "server", 876, "Server", "기존 맵 actor에서 플레이어를 제거하고 leave를 브로드캐스트합니다.", ["RemovePlayer", "S_PlayerLeave"], "authority"),
          node("add-map", "Map B 등록", "entity ID 유지", "server", 1078, "Server", "목적 맵 job queue에서 동일 entity ID로 플레이어를 추가합니다.", ["AddPlayerWithId", "ADR-026"], "authority"),
          node("transition-packet", "S_MapTransition", "map + spawn", "contract", 1280, "Shared", "목적 mapId와 spawn 좌표를 본인에게만 통지합니다.", ["destMapId", "spawnX/Y"], "result"),
          node("scene-load", "씬 전환", "roster drain", "client", 1482, "Client", "연결을 유지한 채 씬을 로드하고 버퍼링된 roster를 반영합니다.", ["SceneRouter", "RosterTransitionBuffer"], "result"),
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
      generation: {
        ...base, id: "generation", title: "패킷 생성", kicker: "PACKET GENERATOR",
        description: "PacketGenerator가 PDL.xml을 읽고 Shared 패킷 계약과 양쪽 packet manager 코드를 생성하는 흐름입니다.",
        nodes: [
          node("pdl", "PDL.xml", "packet schema", "tool", 68, "Tool", "패킷 이름, 필드, 리스트 구조를 XML 계약으로 정의합니다.", ["PDL.xml", "schema"], "intent"),
          node("program", "Program.Main", "parse + emit", "tool", 292, "Tool", "XmlReader로 packet/member/list를 순회하고 생성 문자열을 조립합니다.", ["ParsePacket", "ParseMembers"], "authority"),
          node("format", "PacketFormat", "template catalog", "tool", 516, "Tool", "packet, enum, manager, read/write 템플릿을 한곳에서 제공합니다.", ["packetFormat", "managerFormat"]),
          node("gen-packets", "GenPackets.cs", "shared contract", "contract", 740, "Shared", "양쪽 런타임이 함께 쓰는 PacketID, IPacket, read/write 코드를 생성합니다.", ["98_Shared/Protocol/Generated"], "result"),
          node("server-manager", "ServerPacketManager", "server dispatch", "server", 964, "Server", "서버 handler 등록 코드를 생성해 수신 패킷을 게임 로직으로 연결합니다.", ["GameServer/Network/Generated"], "result"),
          node("client-manager", "ClientPacketManager", "client dispatch", "transport", 1188, "ClientNet", "클라이언트 packet manager를 생성해 wire 패킷을 클라이언트 처리기로 연결합니다.", ["04_ClientNet/Generated"], "result"),
          node("runtime-contract", "런타임 계약", "same packet IDs", "client", 1412, "Client", "Client와 Server가 같은 Shared 계약과 manager 출력을 기준으로 통신합니다.", ["PacketID", "wire compatibility"], "result"),
        ],
        edges: [
          { from: "pdl", to: "program", label: "read", tone: "intent" },
          { from: "program", to: "format", label: "format" },
          { from: "format", to: "gen-packets", label: "emit", tone: "result" },
          { from: "format", to: "server-manager", label: "emit", tone: "result" },
          { from: "format", to: "client-manager", label: "emit", tone: "result" },
          { from: "gen-packets", to: "runtime-contract", label: "consume", tone: "result" },
          { from: "server-manager", to: "runtime-contract", label: "dispatch", tone: "result" },
          { from: "client-manager", to: "runtime-contract", label: "dispatch", tone: "result" },
        ],
      },
    };
  }

  function createClassAreas() {
    return {
      client: { id: "client", title: "클라이언트 영역", kicker: "CLIENT + CLIENTNET", layers: ["Client", "ClientNet"], description: "입력, 예측, 화면 표현, Unity 세션과 클라이언트 socket 계층의 핵심 타입입니다." },
      server: { id: "server", title: "서버 영역", kicker: "SERVER", layers: ["Server"], description: "세션, handler, map actor, combat, migration과 서버 socket 계층의 핵심 타입입니다." },
      shared: { id: "shared", title: "공유 영역", kicker: "PROTOCOL + GAME DATA", layers: ["Shared"], description: "클라이언트와 서버가 함께 사용하는 패킷 계약, 열거형, 물리 및 게임 데이터 타입입니다." },
      tool: { id: "tool", title: "도구 영역", kicker: "PACKET GENERATOR", layers: ["Tool"], description: "PDL.xml에서 Shared, Server, ClientNet의 패킷 코드를 생성하는 PacketGenerator 타입입니다." },
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
  function nextZoom(current, delta, resetValue) {
    if (delta === 0) return resetValue;
    return Math.min(1.6, Math.max(.75, current + delta));
  }
  function zoomControls(kind, value, label, baseValue = 1) {
    const percent = Math.round(value * 100);
    return `<div class="zoom-controls" aria-label="${attr(label)} 확대 축소">
      <button class="ghost-button" data-${attr(kind)}-zoom="-.1" aria-label="${attr(label)} 축소">−</button>
      <button class="ghost-button zoom-reset" data-${attr(kind)}-zoom="0" aria-label="${attr(label)} 기준 배율">${percent}%</button>
      <button class="ghost-button" data-${attr(kind)}-zoom=".1" aria-label="${attr(label)} 확대">+</button>
    </div>`;
  }
  function diagramZoomStyle(value, baseValue = 1) {
    return `width:${Math.round((value / baseValue) * 100)}%`;
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
    if (layer === "Client") return parts.slice(3).join("/") || "Scripts";
    if (layer === "Server") return parts.slice(2).join("/") || parts.at(-1);
    return parts.slice(1).join("/") || parts[0];
  }
  function formatDate(value) { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  function number(value) { return new Intl.NumberFormat("ko-KR").format(value); }
  function initialView() {
    const requested = location.hash.replace("#", "");
    return viewNames.has(requested) ? requested : "overview";
  }
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
