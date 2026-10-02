"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Activity, ArrowRight, Bot, Check, ChevronDown, Clock3, Code2, Copy, Database, GitBranch, Globe2, History, LayoutGrid, Menu, MessageSquare, MoreHorizontal, Play, Plus, RotateCcw, Save, Search, Settings2, ShieldCheck, Sparkles, Terminal, Trash2, Upload, Webhook, X, Zap } from "lucide-react";
import { chattyRequest } from "./lib";
import { nodeCatalog, type NodeDefinition } from "./node-registry";
import { importN8nWorkflow } from "./n8n-import";
import type { FlowEdge, FlowNode } from "./types";


// New flows start empty. This avoids presenting sample workflows as saved data.
const initialNodes: FlowNode[] = [];
const initialEdges: FlowEdge[] = [];

function NodeIcon({ icon, size = 17 }: { icon: string; size?: number }) {
  const props = { size, strokeWidth: 2 };
  if (icon === "chatty") return <Bot {...props} />;
  if (icon === "webhook") return <Webhook {...props} />;
  if (icon === "globe") return <Globe2 {...props} />;
  if (icon === "branch") return <GitBranch {...props} />;
  if (icon === "clock") return <Clock3 {...props} />;
  if (icon === "spark") return <Sparkles {...props} />;
  if (icon === "sheet") return <Database {...props} />;
  if (icon === "crm") return <Database {...props} />;
  if (icon === "slack") return <MessageSquare {...props} />;
  if (icon === "zapier") return <Zap {...props} />;
  if (icon === "make") return <Activity {...props} />;
  if (icon === "n8n") return <Zap {...props} />;
  return <Code2 {...props} />;
}

const chattyEvents = [
  "session.started", "session.ended", "session.assigned", "session.resolved",
  "session.transferred", "message.user", "message.assistant", "message.agent",
  "lead.created", "lead.updated", "lead.exported", "meeting.booked",
  "meeting.cancelled", "meeting.rescheduled", "sla.first_response_breached",
  "sla.resolution_breached", "csat.submitted", "knowledge.source_added",
  "knowledge.source_deleted",
];

export default function FlowBuilderPage() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialEdges);
  const [selectedId, setSelectedId] = useState("condition");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "native" | "apps">("all");
  const [mobilePanel, setMobilePanel] = useState<"palette" | "inspector" | null>(null);
  const [running, setRunning] = useState(false);
  const [testTrace, setTestTrace] = useState<Array<{ node_id: string; title: string; status: string }>>([]);
  const [testError, setTestError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [published, setPublished] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [botId, setBotId] = useState<string | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [syncState, setSyncState] = useState("Local draft");
  const [flowName, setFlowName] = useState("New workflow");
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const filteredCatalog = useMemo(() => nodeCatalog.filter((item) => {
    const matchesSearch = `${item.title} ${item.subtitle} ${item.provider}`.toLowerCase().includes(search.toLowerCase());
    const isNative = ["Chatty", "Chatty AI", "Flow control", "HTTP", "Email"].includes(item.provider);
    const matchesSource = sourceFilter === "all" || (sourceFilter === "native" ? isNative : !isNative);
    return matchesSearch && matchesSource;
  }), [search, sourceFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedBot = params.get("bot_id") || params.get("botId");
    const selectedFlow = params.get("flow_id");
    setBotId(selectedBot);
    setFlowId(selectedFlow);
    if (!selectedBot) return;
    void chattyRequest(`/api/flow-builder/versions?bot_id=${encodeURIComponent(selectedBot)}`).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { versions?: Array<{ id: string; flow_id?: string; flow_name?: string; version: number; flow_data: { nodes?: FlowNode[]; edges?: FlowEdge[] }; status: string }> };
      const latest = payload.versions?.find((item) => !selectedFlow || item.flow_id === selectedFlow);
      if (!latest?.flow_data) return;
      setFlowId(latest.flow_id || selectedFlow); setFlowName(latest.flow_name || "New workflow"); setNodes(latest.flow_data.nodes ?? []); setEdges(latest.flow_data.edges ?? []); setVersion(latest.version); setPublished(latest.status === "published"); setSaved(true); setSyncState("Synced from Chatty");
    }).catch(() => setSyncState("Offline draft"));
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setNodes((current) => current.map((node) => node.id === drag.id
        ? { ...node, x: Math.max(12, event.clientX - drag.dx), y: Math.max(72, event.clientY - drag.dy) }
        : node));
      setSaved(false);
    };
    const end = () => { dragRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
  }, []);

  function startDrag(event: React.PointerEvent<HTMLDivElement>, node: FlowNode) {
    event.stopPropagation();
    dragRef.current = { id: node.id, dx: event.clientX - node.x, dy: event.clientY - node.y };
    setSelectedId(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  async function saveDraft(publish = false) {
    if (!botId) { setSaved(true); setSyncState("Local draft"); return; }
    setSyncState("Saving…");
    try {
      const response = publish
        ? await chattyRequest("/api/flow-builder/publish", { method: "POST", body: JSON.stringify({ bot_id: botId, flow_id: flowId, name: flowName, version: version || 1, flow_data: { nodes, edges }, note: "Published from Chatty Flow Builder" }) })
        : await chattyRequest("/api/flow-builder/versions", { method: "POST", body: JSON.stringify({ bot_id: botId, flow_id: flowId, name: flowName, flow_data: { nodes, edges }, note: "Saved from Chatty Flow Builder" }) });
      if (!response.ok) { setSyncState(`Save failed (${response.status})`); return; }
      const result = await response.json() as { version?: number; flow_id?: string; published?: boolean };
      if (result.flow_id) setFlowId(result.flow_id);
      if (result.version) setVersion(typeof result.version === "number" ? result.version : version);
      setSaved(true); setPublished(publish); setSyncState(publish ? "Published to Chatty" : "Saved to Chatty");
    } catch { setSyncState("Save failed: network error"); }
  }

  async function runTest() {
    setRunning(true);
    setTestError(null);
    setTestTrace([]);
    if (!botId) {
      setTestError("Open this builder from a Chatty bot to run a tenant-authorized test.");
      return;
    }
    try {
      const response = await chattyRequest("/api/flow-builder/test", { method: "POST", body: JSON.stringify({ bot_id: botId, flow_id: flowId, flow_data: { nodes, edges } }) });
      const body = await response.json() as { detail?: string; trace?: Array<{ node_id: string; title: string; status: string }> };
      if (!response.ok) { setTestError(body.detail || "The flow test failed."); return; }
      setTestTrace(body.trace || []);
    } catch { setTestError("The flow test could not reach Chatty."); }
  }

  function addNode(item: NodeDefinition) {
    const id = `${item.title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const newNode: FlowNode = { ...item, id, x: 250 + ((nodes.length * 44) % 280), y: 120 + ((nodes.length * 54) % 300), config: { provider: item.provider, operation: item.operations[0] ?? "" } };
    setNodes((current) => [...current, newNode]); setSelectedId(id); setSaved(false); setMobilePanel(null);
  }
  function updateConfig(key: string, value: string) {
    if (!selected) return;
    setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, config: { ...node.config, [key]: value } } : node)); setSaved(false);
  }
  function deleteSelected() {
    if (!selected) return;
    setNodes((current) => current.filter((node) => node.id !== selected.id)); setEdges((current) => current.filter((edge) => edge.from !== selected.id && edge.to !== selected.id)); setSelectedId(""); setSaved(false);
  }
  function connectTo(targetId: string) {
    if (!selected || selected.id === targetId || edges.some((edge) => edge.from === selected.id && edge.to === targetId)) return;
    setEdges((current) => [...current, { from: selected.id, to: targetId }]); setSaved(false);
  }

  async function handleN8nImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = importN8nWorkflow(JSON.parse(await file.text()));
      setNodes(imported.nodes);
      setEdges(imported.edges);
      setSelectedId(imported.nodes[0]?.id ?? "");
      setSaved(false);
      setSyncState("Imported n8n draft");
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "The n8n workflow could not be imported.");
      setRunning(true);
    }
  }

  return <main className="builder-shell">
    <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void handleN8nImport(event)} />
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Sparkles size={17} /></div><div><strong>Chatty Flows</strong><span>Automation workspace</span></div></div>
      <div className="crumb"><span>Chatty</span><ChevronDown size={14} /><span className="muted">/</span><strong>{flowName}</strong><span className="draft-pill"><span className="status-dot" /> {published ? "Published" : "Draft"}</span></div>
      <div className="top-actions"><button className="icon-btn mobile-only" onClick={() => setMobilePanel("palette")} aria-label="Open node library"><Menu size={18} /></button><button className="secondary" onClick={() => importRef.current?.click()}><Upload size={14} /> Import n8n</button><button className="secondary" onClick={() => void runTest()}><Play size={14} /> Test</button><button className="secondary save-button" onClick={() => void saveDraft(false)}><Save size={14} /> Save draft</button><button className="primary" onClick={() => void saveDraft(true)}><Check size={14} /> Publish</button><button className="avatar">A</button></div>
    </header>
    <div className="workspace">
      <aside className={`palette ${mobilePanel === "palette" ? "mobile-open" : ""}`}>
        <div className="panel-head"><div><small>BUILD</small><h2>Node library</h2></div><button className="icon-btn mobile-only" onClick={() => setMobilePanel(null)}><X size={17} /></button></div>
        <div className="search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search available actions" /></div>
        <div className="source-row"><button className={`source ${sourceFilter === "all" ? "active" : ""}`} onClick={() => setSourceFilter("all")}>Chatty</button><button className={`source ${sourceFilter === "native" ? "active" : ""}`} onClick={() => setSourceFilter("native")}>Native</button><button className={`source ${sourceFilter === "apps" ? "active" : ""}`} onClick={() => setSourceFilter("apps")}>Apps</button></div>
        <div className="catalog">{filteredCatalog.map((item) => <button key={item.title} className="catalog-item" onClick={() => addNode(item)}><span className="catalog-icon" style={{ color: item.color, background: `${item.color}16` }}><NodeIcon icon={item.icon} size={16} /></span><span><b>{item.title}</b><small>{item.subtitle}</small></span><Plus size={14} className="add-icon" /></button>)}</div>
        <div className="library-foot"><ShieldCheck size={15} /><span>Every action is tenant-scoped and replay-safe.</span></div>
      </aside>
      <section className="canvas-area">
        <div className="canvas-toolbar"><div className="toolbar-group"><button className="tool-active"><LayoutGrid size={15} /> Canvas</button><button><History size={15} /> History</button></div><div className="toolbar-group"><button onClick={() => setZoom((value) => Math.max(60, value - 10))}>−</button><span>{zoom}%</span><button onClick={() => setZoom((value) => Math.min(140, value + 10))}>+</button><button onClick={() => setZoom(100)}><RotateCcw size={14} /></button></div></div>
        <div className="canvas" style={{ "--zoom": zoom / 100 } as CSSProperties} onClick={() => setSelectedId("")}>
          <div className="grid-bg" />
          <svg className="edges" viewBox="0 0 1100 620" preserveAspectRatio="none">{edges.map((edge) => { const from = nodes.find((node) => node.id === edge.from); const to = nodes.find((node) => node.id === edge.to); if (!from || !to) return null; const sx = from.x + 218, sy = from.y + 64, tx = to.x, ty = to.y + 64; return <path key={`${edge.from}-${edge.to}`} d={`M ${sx} ${sy} C ${sx + 80} ${sy}, ${tx - 80} ${ty}, ${tx} ${ty}`} />; })}</svg>
          <div className="canvas-content">{nodes.map((node) => <div key={node.id} className={`flow-node ${selectedId === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y, "--node-color": node.color } as CSSProperties} onClick={(event) => { event.stopPropagation(); setSelectedId(node.id); setMobilePanel("inspector"); }}><div className="node-port in" /><div className="node-top" onPointerDown={(event) => startDrag(event, node)}><span className="node-icon"><NodeIcon icon={node.icon} size={17} /></span><span className="node-kind">{node.kind}</span><button className="node-menu"><MoreHorizontal size={15} /></button></div><b>{node.title}</b><span className="node-subtitle">{node.subtitle}</span><div className="node-footer"><span className="node-check"><Check size={11} /></span>{node.kind === "trigger" ? "Listening" : "Configured"}<span className="node-port out" onClick={(event) => { event.stopPropagation(); }} /></div>{selectedId === node.id && <div className="connect-hint">Select another node to connect</div>}</div>)}</div>
          <div className="canvas-empty"><span>Drag a node from the library to extend this flow</span></div>
        </div>
        <div className="canvas-status"><span><span className={`green-dot ${saved ? "" : "pending"}`} /> {syncState}</span><span>{nodes.length} nodes · {edges.length} connections</span><span className="status-right">{published ? `Published v${version || 1}` : saved ? "Draft ready" : "Unsaved changes"}</span></div>
      </section>
      <aside className={`inspector ${mobilePanel === "inspector" ? "mobile-open" : ""}`}>
        <div className="panel-head"><div><small>CONFIGURE</small><h2>{selected ? selected.title : "Select a node"}</h2></div><button className="icon-btn mobile-only" onClick={() => setMobilePanel(null)}><X size={17} /></button></div>
        {selected ? <div className="inspector-body"><div className="selected-summary"><span className="summary-icon" style={{ color: selected.color, background: `${selected.color}16` }}><NodeIcon icon={selected.icon} /></span><div><b>{selected.title}</b><span>{selected.subtitle}</span></div></div><label>Node label<input value={selected.title} onChange={(event) => setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, title: event.target.value } : node))} /></label>{Object.entries(selected.config).map(([key, value]) => <label key={key}>{key.replace(/_/g, " ")}{key === "operation" && (selected.operations?.length ?? 0) > 1 ? <select value={value} onChange={(event) => updateConfig(key, event.target.value)}>{selected.operations?.map((operation) => <option key={operation}>{operation}</option>)}</select> : <input value={value} onChange={(event) => updateConfig(key, event.target.value)} />}</label>)}{selected.kind === "action" && !selected.config.url && <label>Adapter endpoint URL<input type="url" placeholder="https://..." onChange={(event) => updateConfig("url", event.target.value)} /></label>}{selected.kind === "action" && selected.config.url && <label>Method<select value={selected.config.method ?? "POST"} onChange={(event) => updateConfig("method", event.target.value)}><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></label>}{selected.kind === "trigger" && <label>Event type<select value={selected.config.event ?? "lead.created"} onChange={(event) => updateConfig("event", event.target.value)}>{chattyEvents.map((event) => <option key={event}>{event}</option>)}</select></label>}<div className="inspector-section"><div className="section-title">Reliability</div><div className="toggle-row"><span><b>Retry failed runs</b><small>3 attempts with backoff</small></span><span className="toggle on" /></div><div className="toggle-row"><span><b>Idempotency key</b><small>Prevent duplicate side effects</small></span><span className="toggle on" /></div></div>{selected.kind !== "trigger" && <div className="connect-list"><div className="section-title">Connect to</div>{nodes.filter((node) => node.id !== selected.id).map((node) => <button key={node.id} onClick={() => connectTo(node.id)}><NodeIcon icon={node.icon} size={14} />{node.title}<ArrowRight size={14} /></button>)}</div>}<button className="delete-btn" onClick={deleteSelected}><Trash2 size={14} /> Remove node</button></div> : <div className="empty-inspector"><Settings2 size={22} /><p>Select a node to configure its action, retries, credentials, and outputs.</p></div>}
      </aside>
    </div>
    <footer className="mobile-nav"><button onClick={() => setMobilePanel("palette")}><Plus size={17} /><span>Add</span></button><button className="mobile-run" onClick={() => void runTest()}><Play size={17} /><span>Test</span></button><button onClick={() => setMobilePanel("inspector")}><Settings2 size={17} /><span>Inspect</span></button></footer>
    {running && <div className="modal-backdrop"><div className="run-modal"><div className="modal-title"><div><small>VALIDATION RUN</small><h2>Flow test</h2></div><button className="icon-btn" onClick={() => setRunning(false)}><X size={18} /></button></div>{testError ? <div className="run-error">{testError}</div> : testTrace.length ? testTrace.map((step) => <div className="run-progress" key={step.node_id}><span className="run-icon"><Check size={16} /></span><div><b>{step.title}</b><small>{step.status} · no external side effects</small></div></div>) : <div className="run-progress active"><span className="spinner" /><div><b>Validating graph</b><small>Checking connections and execution order…</small></div></div>}<button className="secondary full" onClick={() => setRunning(false)}>Close test run</button></div></div>}
  </main>;
}

