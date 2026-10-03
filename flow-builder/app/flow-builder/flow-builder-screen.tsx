"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronDown, Download, History, LayoutGrid, Menu, Play, Plus, Redo2, RotateCcw, Save, Search, Settings2, ShieldCheck, Sparkles, Trash2, Undo2, Upload, UserCircle2, X } from "lucide-react";
import { chattyRequest } from "./lib";
import { exportN8nWorkflow } from "./n8n-export";
import { importN8nWorkflow } from "./n8n-import";
import { findNodeDefinition, nodeCatalog, type NodeDefinition, type NodeField } from "./node-registry";
import { FlowCanvas, type FlowCanvasCommands } from "./flow-canvas";
import { NodeIcon } from "./node-icon";
import { RunHistory } from "./run-history";
import type { FlowData, FlowEdge, FlowNode, FlowRun, FlowRunTrace } from "./types";

type GraphSnapshot = FlowData;

const emptyGraph: FlowData = { nodes: [], edges: [] };

const chattyEvents = [
  "session.started", "session.ended", "session.assigned", "session.resolved", "session.transferred",
  "message.user", "message.assistant", "message.agent", "lead.created", "lead.updated", "lead.exported",
  "meeting.booked", "meeting.cancelled", "meeting.rescheduled", "sla.first_response_breached",
  "sla.resolution_breached", "csat.submitted", "knowledge.source_added", "knowledge.source_deleted",
];

function cloneGraph(graph: GraphSnapshot): GraphSnapshot {
  return { nodes: graph.nodes.map((node) => ({ ...node, config: { ...node.config }, n8nParameters: node.n8nParameters ? { ...node.n8nParameters } : undefined })), edges: graph.edges.map((edge) => ({ ...edge })) };
}

function graphKey(graph: GraphSnapshot) {
  return JSON.stringify(graph);
}

function persistedGraph(graph: GraphSnapshot): GraphSnapshot {
  return {
    nodes: graph.nodes.map(({ executionState: _executionState, lastError: _lastError, ...node }) => node),
    edges: graph.edges,
  };
}

function NodeFieldEditor({ field, value, onChange }: { field: NodeField; value: string; onChange: (value: string) => void }) {
  if (field.type === "select") return <select value={value} onChange={(event) => onChange(event.target.value)}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>;
  if (field.type === "textarea" || field.type === "json") return <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={field.type === "json" ? 7 : 4} spellCheck={false} />;
  return <input type={field.type === "url" ? "url" : field.type === "number" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />;
}

export default function FlowBuilderPage() {
  const [nodes, setNodes] = useState<FlowNode[]>(emptyGraph.nodes);
  const [edges, setEdges] = useState<FlowEdge[]>(emptyGraph.edges);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "native" | "apps">("all");
  const [mobilePanel, setMobilePanel] = useState<"palette" | "inspector" | null>(null);
  const [nodeMenuId, setNodeMenuId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [testTrace, setTestTrace] = useState<FlowRunTrace[]>([]);
  const [testError, setTestError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [published, setPublished] = useState(false);
  const [botId, setBotId] = useState<string | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [syncState, setSyncState] = useState("Local draft");
  const [flowName, setFlowName] = useState("New workflow");
  const [view, setView] = useState<"canvas" | "history">("canvas");
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<FlowRun | null>(null);
  const [runsRefresh, setRunsRefresh] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const canvasCommandsRef = useRef<FlowCanvasCommands | null>(null);
  const graphRef = useRef<GraphSnapshot>(emptyGraph);
  const historyRef = useRef<GraphSnapshot[]>([]);
  const futureRef = useRef<GraphSnapshot[]>([]);
  const [historySize, setHistorySize] = useState(0);
  const [futureSize, setFutureSize] = useState(0);

  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const selectedDefinition = selected ? findNodeDefinition(selected) : undefined;
  const filteredCatalog = useMemo(() => nodeCatalog.filter((item) => {
    const query = `${item.title} ${item.subtitle} ${item.provider} ${item.category}`.toLowerCase();
    const matchesSearch = query.includes(search.toLowerCase());
    const isNative = ["Chatty", "Chatty AI", "Flow control", "HTTP", "Email"].includes(item.provider);
    return matchesSearch && (sourceFilter === "all" || (sourceFilter === "native" ? isNative : !isNative));
  }), [search, sourceFilter]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (nodes.length === 0) issues.push("Add at least one node.");
    if (!nodes.some((node) => node.kind === "trigger")) issues.push("Add a trigger node.");
    const ids = new Set<string>();
    for (const node of nodes) {
      if (ids.has(node.id)) issues.push(`Duplicate node id: ${node.id}.`);
      ids.add(node.id);
      const definition = findNodeDefinition(node);
      for (const field of definition?.fields ?? []) {
        if (field.required && !String(node.config[field.key] ?? "").trim() && !(field.key === "url" && node.n8nParameters?.url)) issues.push(`${node.title}: ${field.label} is required.`);
      }
    }
    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
    for (const edge of edges) {
      if (!incoming.has(edge.from) || !incoming.has(edge.to)) issues.push("A connection points to a missing node.");
      if (edge.from === edge.to) issues.push("A node cannot connect to itself.");
      if (outgoing.has(edge.from) && incoming.has(edge.to)) { outgoing.get(edge.from)?.push(edge.to); incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1); }
    }
    const queue = [...incoming.entries()].filter(([, count]) => count === 0).map(([id]) => id);
    let visited = 0;
    while (queue.length) { const id = queue.shift(); if (!id) continue; visited += 1; for (const child of outgoing.get(id) ?? []) { const count = (incoming.get(child) ?? 0) - 1; incoming.set(child, count); if (count === 0) queue.push(child); } }
    if (visited !== nodes.length) issues.push("The workflow contains a cycle.");
    return [...new Set(issues)];
  }, [edges, nodes]);

  useEffect(() => { graphRef.current = { nodes, edges }; }, [edges, nodes]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedBot = params.get("bot_id") || params.get("botId");
    const selectedFlow = params.get("flow_id");
    setBotId(selectedBot);
    setFlowId(selectedFlow);
    if (!selectedBot || !selectedFlow) {
      graphRef.current = emptyGraph;
      setNodes([]); setEdges([]); setFlowName("New workflow"); setVersion(0); setPublished(false); setSaved(true); setSyncState(selectedBot ? "New workflow" : "Local draft");
      return;
    }
    void chattyRequest(`/api/flow-builder/versions?bot_id=${encodeURIComponent(selectedBot)}`).then(async (response) => {
      if (!response.ok) throw new Error(`Sync failed (${response.status})`);
      const payload = await response.json() as { versions?: Array<{ id: string; flow_id?: string; flow_name?: string; version: number; flow_data: FlowData; status: string }> };
      const latest = payload.versions?.find((item) => !selectedFlow || item.flow_id === selectedFlow);
      if (!latest?.flow_data) return;
      const next = { nodes: latest.flow_data.nodes ?? [], edges: latest.flow_data.edges ?? [] };
      graphRef.current = next; setNodes(next.nodes); setEdges(next.edges); setFlowId(latest.flow_id || selectedFlow); setFlowName(latest.flow_name || "New workflow"); setVersion(latest.version); setPublished(latest.status === "published"); setSaved(true); setSyncState("Synced from Chatty"); historyRef.current = []; futureRef.current = []; setHistorySize(0); setFutureSize(0);
    }).catch(() => setSyncState("Offline draft"));
  }, []);

  useEffect(() => {
    if (view !== "history" || !botId) return;
    setRunsLoading(true);
    void chattyRequest(`/api/flow-builder/runs?bot_id=${encodeURIComponent(botId)}${flowId ? `&flow_id=${encodeURIComponent(flowId)}` : ""}`).then(async (response) => {
      if (!response.ok) throw new Error("Runs could not be loaded");
      const payload = await response.json() as { runs?: FlowRun[] };
      setRuns(payload.runs ?? []); setSelectedRun((current) => current ?? payload.runs?.[0] ?? null);
    }).catch(() => setRuns([])).finally(() => setRunsLoading(false));
  }, [botId, flowId, runsRefresh, view]);

  function setGraph(next: GraphSnapshot, record = true) {
    const current = graphRef.current;
    if (graphKey(current) === graphKey(next)) return;
    if (record) { historyRef.current = [...historyRef.current, cloneGraph(current)].slice(-50); futureRef.current = []; setHistorySize(historyRef.current.length); setFutureSize(0); }
    applyGraph(next);
  }

  function applyGraph(next: GraphSnapshot) {
    const copy = cloneGraph(next); graphRef.current = copy; setNodes(copy.nodes); setEdges(copy.edges); setSaved(false);
  }

  function undo() {
    const previous = historyRef.current.at(-1);
    if (!previous) return;
    historyRef.current = historyRef.current.slice(0, -1); futureRef.current = [...futureRef.current, cloneGraph(graphRef.current)]; setHistorySize(historyRef.current.length); setFutureSize(futureRef.current.length); applyGraph(previous);
  }

  function redo() {
    const next = futureRef.current.at(-1);
    if (!next) return;
    futureRef.current = futureRef.current.slice(0, -1); historyRef.current = [...historyRef.current, cloneGraph(graphRef.current)]; setHistorySize(historyRef.current.length); setFutureSize(futureRef.current.length); applyGraph(next);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (modifier && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      if ((event.key === "Backspace" || event.key === "Delete") && selectedId) { event.preventDefault(); removeNode(selectedId); }
      if (event.key === "Escape") { setSelectedId(""); setNodeMenuId(null); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function saveDraft(publish = false) {
    if (!botId) { setSaved(true); setSyncState("Local draft"); return; }
    if (publish && validationIssues.length > 0) { setSyncState("Fix validation errors before publishing"); return; }
    setSyncState(publish ? "Publishing…" : "Saving…");
    try {
      const body = { bot_id: botId, flow_id: flowId, name: flowName.trim() || "New workflow", version: version || 1, flow_data: persistedGraph(graphRef.current), note: publish ? "Published from Chatty Flow Builder" : "Saved from Chatty Flow Builder" };
      const response = await chattyRequest(publish ? "/api/flow-builder/publish" : "/api/flow-builder/versions", { method: "POST", body: JSON.stringify(body) });
      if (!response.ok) { const detail = await response.text(); setSyncState(`Save failed (${response.status})`); setTestError(detail.slice(0, 220)); return; }
      const result = await response.json() as { version?: number; flow_id?: string };
      if (result.flow_id) setFlowId(result.flow_id);
      if (result.version) setVersion(result.version);
      setSaved(true); setPublished(publish); setSyncState(publish ? "Published to Chatty" : "Saved to Chatty");
    } catch { setSyncState("Save failed: network error"); }
  }

  async function runTest() {
    setRunning(true); setTestError(null); setTestTrace([]);
    if (!botId) { setTestError("Open this builder from a Chatty bot to run a tenant-authorized test."); return; }
    try {
      const response = await chattyRequest("/api/flow-builder/test", { method: "POST", body: JSON.stringify({ bot_id: botId, flow_id: flowId, flow_data: persistedGraph(graphRef.current) }) });
      const body = await response.json() as { detail?: string; trace?: FlowRunTrace[] };
      if (!response.ok) { setTestError(body.detail || "The flow test failed."); return; }
      const trace = body.trace || []; setTestTrace(trace);
      const traceById = new Map(trace.map((step) => [step.node_id, step]));
      setNodes((current) => current.map((node) => ({ ...node, executionState: traceById.has(node.id) ? "completed" : "idle", lastError: undefined })));
    } catch { setTestError("The flow test could not reach Chatty."); }
  }

  function addNode(item: NodeDefinition) {
    const id = `${item.type.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${Date.now()}`;
    const newNode: FlowNode = { id, type: item.type, kind: item.kind, title: item.title, subtitle: item.subtitle, icon: item.icon, color: item.color, x: 180 + ((nodes.length * 44) % 360), y: 110 + ((nodes.length * 54) % 300), provider: item.provider, credentialType: item.credentialType, n8nType: item.n8nType, n8nTypeVersion: item.n8nTypeVersion, n8nParameters: {}, operations: item.operations, config: { ...item.defaultConfig, provider: item.provider } };
    setGraph({ nodes: [...graphRef.current.nodes, newNode], edges: graphRef.current.edges }); setSelectedId(id); setMobilePanel(null);
  }

  function updateNode(nodeId: string, update: Partial<FlowNode>) { setGraph({ nodes: graphRef.current.nodes.map((node) => node.id === nodeId ? { ...node, ...update } : node), edges: graphRef.current.edges }); }
  function updateConfig(key: string, value: string) { if (selected) updateNode(selected.id, { config: { ...selected.config, [key]: value } }); }
  function removeNode(nodeId: string) { setGraph({ nodes: graphRef.current.nodes.filter((node) => node.id !== nodeId), edges: graphRef.current.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId) }); setSelectedId(""); setNodeMenuId(null); }
  function duplicateNode(node: FlowNode) { const id = `${node.id}-copy-${Date.now()}`; setGraph({ nodes: [...graphRef.current.nodes, { ...node, id, title: `${node.title} copy`, x: node.x + 36, y: node.y + 36, config: { ...node.config } }], edges: graphRef.current.edges }); setSelectedId(id); setNodeMenuId(null); }
  function connectNodes(sourceId: string, targetId: string) { if (sourceId === targetId || graphRef.current.edges.some((edge) => edge.from === sourceId && edge.to === targetId)) return; setGraph({ nodes: graphRef.current.nodes, edges: [...graphRef.current.edges, { from: sourceId, to: targetId }] }); }
  function moveNodes(nextNodes: FlowNode[]) { setGraph({ nodes: nextNodes, edges: graphRef.current.edges }); }
  function changeEdges(nextEdges: FlowEdge[]) { setGraph({ nodes: graphRef.current.nodes, edges: nextEdges }); }

  async function handleN8nImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try { const imported = importN8nWorkflow(JSON.parse(await file.text())); setGraph(imported, true); setSelectedId(imported.nodes[0]?.id ?? ""); setSyncState("Imported n8n draft"); } catch (error) { setTestError(error instanceof Error ? error.message : "The n8n workflow could not be imported."); setRunning(true); }
  }

  function downloadN8n() {
    const blob = new Blob([JSON.stringify(exportN8nWorkflow(persistedGraph(graphRef.current)), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${(flowName || "chatty-workflow").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  const inspectorFields = selectedDefinition?.fields ?? [{ key: "operation", label: "Operation", type: "text" as const }, { key: "url", label: "Adapter endpoint URL", type: "url" as const, required: selected?.kind === "action", placeholder: "https://..." }];

  return <main className="builder-shell">
    <input ref={importRef} className="sr-only" aria-hidden="true" tabIndex={-1} type="file" accept="application/json,.json" onChange={(event) => void handleN8nImport(event)} />
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Sparkles size={17} /></div><div><strong>Chatty Flows</strong><span>Automation workspace</span></div></div>
      <div className="crumb"><span>Chatty</span><ChevronDown size={14} /><span className="muted">/</span><input className="workflow-name" value={flowName} onChange={(event) => { setFlowName(event.target.value); setSaved(false); }} aria-label="Workflow name" /><span className="draft-pill"><span className="status-dot" /> {published ? "Published" : "Draft"}</span></div>
      <div className="top-actions"><button className="icon-btn mobile-only" onClick={() => setMobilePanel("palette")} aria-label="Open node library"><Menu size={18} /></button><button className="secondary" onClick={() => importRef.current?.click()}><Upload size={14} /> Import n8n</button><button className="secondary" onClick={downloadN8n}><Download size={14} /> Export</button><button className="secondary" onClick={() => void runTest()}><Play size={14} /> Test</button><button className="secondary save-button" onClick={() => void saveDraft(false)} disabled={saved && Boolean(botId)}><Save size={14} /> Save draft</button><button className="primary" onClick={() => void saveDraft(true)} disabled={validationIssues.length > 0}><Check size={14} /> Publish</button><button type="button" className="avatar" aria-label="Account" title="Account"><UserCircle2 size={18} /></button></div>
    </header>
    <div className="workspace">
      {view === "canvas" ? <>
        <aside className={`palette ${mobilePanel === "palette" ? "mobile-open" : ""}`}>
          <div className="panel-head"><div><small>BUILD</small><h2>Node library</h2></div><button className="icon-btn mobile-only" onClick={() => setMobilePanel(null)}><X size={17} /></button></div>
          <div className="search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nodes" /></div>
          <div className="source-row"><button className={`source ${sourceFilter === "all" ? "active" : ""}`} onClick={() => setSourceFilter("all")}>All</button><button className={`source ${sourceFilter === "native" ? "active" : ""}`} onClick={() => setSourceFilter("native")}>Built-in</button><button className={`source ${sourceFilter === "apps" ? "active" : ""}`} onClick={() => setSourceFilter("apps")}>Apps</button></div>
          <div className="catalog">{filteredCatalog.map((item) => <button key={item.type} className="catalog-item" onClick={() => addNode(item)}><span className="catalog-icon" style={{ color: item.color, background: `${item.color}16` }}><NodeIcon icon={item.icon} size={16} /></span><span><b>{item.title}</b><small>{item.subtitle}</small></span><Plus size={14} className="add-icon" /></button>)}</div>
          <div className="library-foot"><ShieldCheck size={15} /><span>Every action is tenant-scoped and replay-safe.</span></div>
        </aside>
        <section className="canvas-area">
          <div className="canvas-toolbar"><div className="toolbar-group"><button className="tool-active" onClick={() => setView("canvas")}><LayoutGrid size={15} /> Canvas</button><button onClick={() => setView("history")}><History size={15} /> History</button><span className="toolbar-divider" /><button onClick={undo} disabled={historySize === 0} aria-label="Undo"><Undo2 size={15} /></button><button onClick={redo} disabled={futureSize === 0} aria-label="Redo"><Redo2 size={15} /></button></div><div className="toolbar-group"><button onClick={() => canvasCommandsRef.current?.zoomOut()} aria-label="Zoom out">−</button><button onClick={() => canvasCommandsRef.current?.resetZoom()} className="zoom-reset">100%</button><button onClick={() => canvasCommandsRef.current?.zoomIn()} aria-label="Zoom in">+</button><button onClick={() => canvasCommandsRef.current?.fitView()} aria-label="Fit workflow"><RotateCcw size={14} /></button></div></div>
          <FlowCanvas nodes={nodes} edges={edges} selectedId={selectedId} nodeMenuId={nodeMenuId} onSelect={(nodeId) => { setSelectedId(nodeId); if (nodeId) setMobilePanel("inspector"); }} onNodesChange={moveNodes} onEdgesChange={changeEdges} onConnect={connectNodes} onDuplicate={duplicateNode} onRemove={removeNode} onToggleMenu={(nodeId) => setNodeMenuId(nodeMenuId === nodeId ? null : nodeId)} onCreateNode={() => setMobilePanel("palette")} commandsRef={canvasCommandsRef} />
          <div className="canvas-status"><span><span className={`green-dot ${saved ? "" : "pending"}`} /> {syncState}</span><span>{nodes.length} nodes · {edges.length} connections</span><span className={`status-right ${validationIssues.length ? "has-issues" : ""}`}>{validationIssues.length ? `${validationIssues.length} validation issue${validationIssues.length === 1 ? "" : "s"}` : published ? `Published v${version || 1}` : saved ? "Draft ready" : "Unsaved changes"}</span></div>
        </section>
        <aside className={`inspector ${mobilePanel === "inspector" ? "mobile-open" : ""}`}>
          <div className="panel-head"><div><small>CONFIGURE</small><h2>{selected ? selected.title : "Select a node"}</h2></div><button className="icon-btn mobile-only" onClick={() => setMobilePanel(null)}><X size={17} /></button></div>
          {selected ? <div className="inspector-body"><div className="selected-summary"><span className="summary-icon" style={{ color: selected.color, background: `${selected.color}16` }}><NodeIcon icon={selected.icon} /></span><div><b>{selected.title}</b><span>{selected.subtitle}</span></div></div><label>Node label<input value={selected.title} onChange={(event) => updateNode(selected.id, { title: event.target.value })} /></label>{selected.n8nType && <label>Node type<input value={selected.n8nType} readOnly aria-readonly="true" /></label>}
            <div className="inspector-section"><div className="section-title">Parameters</div>{inspectorFields.map((field) => <label key={field.key}>{field.label}{field.required && <span className="required-mark"> *</span>}<NodeFieldEditor field={field} value={selected.config[field.key] ?? (field.key === "event" ? chattyEvents[0] : "")} onChange={(value) => updateConfig(field.key, value)} />{field.helpText && <small className="field-help">{field.helpText}</small>}</label>)}</div>
            {selected.n8nType && <div className="inspector-section"><div className="section-title">n8n parameters</div><textarea className="json-editor" value={JSON.stringify(selected.n8nParameters ?? {}, null, 2)} onChange={(event) => { try { updateNode(selected.id, { n8nParameters: JSON.parse(event.target.value) as Record<string, unknown> }); } catch { /* Keep the last valid JSON until the user finishes typing. */ } }} spellCheck={false} rows={8} /></div>}
            <div className="inspector-section"><div className="section-title">Reliability</div><div className="toggle-row"><span><b>Retry failed runs</b><small>Three attempts with backoff</small></span><span className="toggle on" /></div><div className="toggle-row"><span><b>Idempotency key</b><small>Prevent duplicate side effects</small></span><span className="toggle on" /></div></div>
            {selected.kind !== "trigger" && <div className="connect-list"><div className="section-title">Connect to</div>{nodes.filter((node) => node.id !== selected.id).map((node) => <button key={node.id} onClick={() => connectNodes(selected.id, node.id)}><NodeIcon icon={node.icon} size={14} />{node.title}<ArrowRight size={14} /></button>)}</div>}
            <button className="delete-btn" onClick={() => removeNode(selected.id)}><Trash2 size={14} /> Remove node</button>
          </div> : <div className="empty-inspector"><Settings2 size={22} /><p>Select a node to configure its parameters, credentials, retries, and outputs.</p></div>}
          {validationIssues.length > 0 && <div className="validation-box"><div><AlertCircle size={14} /><b>Before publishing</b></div>{validationIssues.slice(0, 4).map((issue) => <p key={issue}>{issue}</p>)}</div>}
        </aside>
      </> : <section className="history-area"><RunHistory runs={runs} loading={runsLoading} selectedRun={selectedRun} onSelect={setSelectedRun} onRefresh={() => setRunsRefresh((value) => value + 1)} /></section>}
    </div>
    <footer className="mobile-nav"><button onClick={() => setMobilePanel("palette")}><Plus size={17} /><span>Add</span></button><button className="mobile-run" onClick={() => void runTest()}><Play size={17} /><span>Test</span></button><button onClick={() => setMobilePanel("inspector")}><Settings2 size={17} /><span>Inspect</span></button></footer>
    {running && <div className="modal-backdrop"><div className="run-modal"><div className="modal-title"><div><small>VALIDATION RUN</small><h2>Flow test</h2></div><button className="icon-btn" onClick={() => setRunning(false)}><X size={18} /></button></div>{testError ? <div className="run-error">{testError}</div> : testTrace.length ? testTrace.map((step) => <div className="run-progress" key={step.node_id}><span className="run-icon"><CheckCircle2 size={16} /></span><div><b>{step.title}</b><small>{step.status} · no external side effects</small></div></div>) : <div className="run-progress active"><span className="spinner" /><div><b>Validating graph</b><small>Checking connections and execution order…</small></div></div>}<button className="secondary full" onClick={() => setRunning(false)}>Close test run</button></div></div>}
  </main>;
}
