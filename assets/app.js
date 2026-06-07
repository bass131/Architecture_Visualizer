(() => {
  "use strict";

  const data = window.ARCHITECTURE_DATA;
  const main = document.querySelector("#main-content");
  const tree = document.querySelector("#type-tree");
  const contextPanel = document.querySelector("#context-panel");
  const searchInput = document.querySelector("#search-input");
  const showTests = document.querySelector("#show-tests");
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
  const state = {
    view: "overview",
    selectedTypeId: pickInitialType(),
    selectedMethodId: null,
    search: "",
    diagnosticSeverity: "all",
    diagnosticPrinciple: "all",
    layerFilter: null,
  };

  document.querySelector("#generated-at").textContent =
    `${formatDate(data.generatedAtUtc)} · ${data.summary.files}개 파일`;

  bindEvents();
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
    });

    searchInput.addEventListener("input", () => {
      state.search = searchInput.value.trim().toLowerCase();
      state.layerFilter = null;
      renderTree();
    });
    showTests.addEventListener("change", renderTree);
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
    if (!showTests.checked && type.isTest) return false;
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
        <div class="panel-header"><h2>아키텍처 흐름</h2><span class="muted">서버 권위형 데이터 경로</span></div>
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
  }

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
          <div class="panel-header"><h2>로컬 관계도</h2><span class="muted">노드를 클릭해 이동</span></div>
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
    const relations = [...outgoing.map(item => ({ ...item, direction: "out" })), ...incoming.map(item => ({ ...item, direction: "in" }))]
      .filter((item, index, array) => array.findIndex(other => `${other.sourceId}|${other.targetId}|${other.kind}` === `${item.sourceId}|${item.targetId}|${item.kind}`) === index)
      .slice(0, 16);
    const width = 760, height = 390, centerX = width / 2, centerY = height / 2;
    const radius = Math.min(width, height) * .37;
    const nodes = relations.map((relation, index) => {
      const id = relation.sourceId === type.id ? relation.targetId : relation.sourceId;
      const angle = (Math.PI * 2 * index / Math.max(relations.length, 1)) - Math.PI / 2;
      return { id, relation, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
    });
    return `<svg class="relation-graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="${attr(type.name)} 관계도">
      ${nodes.map(node => `<line class="graph-edge ${attr(node.relation.kind)}" x1="${centerX}" y1="${centerY}" x2="${node.x}" y2="${node.y}"/><text class="graph-label" x="${(centerX + node.x) / 2}" y="${(centerY + node.y) / 2 - 4}">${escapeHtml(node.relation.kind)}</text>`).join("")}
      ${nodes.map(node => graphNode(typeById.get(node.id), node.x, node.y, false)).join("")}
      ${graphNode(type, centerX, centerY, true)}
    </svg>`;
  }

  function graphNode(type, x, y, selected) {
    if (!type) return "";
    const name = type.name.length > 22 ? type.name.slice(0, 20) + "…" : type.name;
    return `<g class="graph-node ${selected ? "selected" : ""}" data-type-id="${attr(type.id)}" transform="translate(${x - 62},${y - 24})"><rect width="124" height="48"></rect><text x="62" y="21">${escapeHtml(name)}</text><text class="node-kind" x="62" y="36">${escapeHtml(type.kind)}</text></g>`;
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
    if (!showTests.checked && type.isTest) return false;
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
