"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { AlertCircle, Check, CheckCircle2, ChevronDown, Download, ExternalLink, History, LayoutGrid, Loader2, Menu, Play, Plus, Redo2, RotateCcw, Save, Settings2, Undo2, Upload, UserCircle2, X } from "lucide-react";
import { chattyRequest, getFlowSession, hasFlowHandoff, supabase } from "./lib";
import { exportN8nWorkflow } from "./n8n-export";
import { importN8nWorkflow } from "./n8n-import";
import { findNodeDefinition, nodeCatalog, type NodeDefinition } from "./node-registry";
import { FlowCanvas, type FlowCanvasCommands } from "./flow-canvas";
import { RunHistory } from "./run-history";
import { createTemplateGraph, flowTemplates, type FlowTemplate } from "./templates";
import { FlowLibrary } from "./flow-library";
import { NodeInspector } from "./node-inspector";
import { ConnectionModal } from "./connection-modal";
import { getProviderConnection } from "./connections";
import type { FlowConnection, FlowData, FlowEdge, FlowNode, FlowRun, FlowRunTrace } from "./types";

type GraphSnapshot = FlowData;
type BusyAction = "import" | "test" | "save" | "publish" | null;
type AuthState = "checking" | "session" | "handoff" | "required";

const emptyGraph: FlowData = { nodes: [], edges: [], paths: [] };

function cloneGraph(graph: GraphSnapshot): GraphSnapshot {
  return { nodes: graph.nodes.map((node) => ({ ...node, config: { ...node.config }, n8nParameters: node.n8nParameters ? { ...node.n8nParameters } : undefined })), edges: graph.edges.map((edge) => ({ ...edge })), paths: graph.paths?.map((path) => ({ ...path })) };
}

function graphKey(graph: GraphSnapshot) {
  return JSON.stringify(graph);
}

function persistedGraph(graph: GraphSnapshot): GraphSnapshot {
  return {
    nodes: graph.nodes.map(({ executionState: _executionState, lastError: _lastError, ...node }) => node),
    edges: graph.edges,
    paths: graph.paths,
  };
}

export default function FlowBuilderPage() {
  const [nodes, setNodes] = useState<FlowNode[]>(emptyGraph.nodes);
  const [edges, setEdges] = useState<FlowEdge[]>(emptyGraph.edges);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "native" | "apps">("all");
  const [libraryView, setLibraryView] = useState<"nodes" | "templates">("nodes");
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
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authEmail, setAuthEmail] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [refreshingAuth, setRefreshingAuth] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<FlowTemplate | null>(null);
  const [connections, setConnections] = useState<FlowConnection[]>([]);
  const [connectionProvider, setConnectionProvider] = useState<ReturnType<typeof getProviderConnection> | null>(null);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [pendingPathId, setPendingPathId] = useState("main");
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const canvasCommandsRef = useRef<FlowCanvasCommands | null>(null);
  const graphRef = useRef<GraphSnapshot>(emptyGraph);
  const historyRef = useRef<GraphSnapshot[]>([]);
  const futureRef = useRef<GraphSnapshot[]>([]);
  const [historySize, setHistorySize] = useState(0);
  const [futureSize, setFutureSize] = useState(0);

  const selected = nodes.find((node) => node.id === selectedId) ?? null;
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
      const connectionDefinition = getProviderConnection(node);
      if (connectionDefinition && node.kind === "action" && !String(node.config.connection_id ?? "").trim()) issues.push(`${node.title}: connect a ${connectionDefinition.provider} account.`);
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

  useEffect(() => { graphRef.current = { nodes, edges, paths: graphRef.current.paths }; }, [edges, nodes]);

  useEffect(() => {
    let active = true;
    void getFlowSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setAuthState("session");
        setAuthEmail(data.session.user.email ?? "");
      } else if (hasFlowHandoff()) {
        setAuthState("handoff");
      } else {
        setAuthState("required");
      }
    }).catch(() => {
      if (active) setAuthState(hasFlowHandoff() ? "handoff" : "required");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthState(session ? "session" : hasFlowHandoff() ? "handoff" : "required");
      setAuthEmail(session?.user.email ?? "");
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedBot = params.get("bot_id") || params.get("botId");
    const selectedFlow = params.get("flow_id");
    const selectedTemplate = params.get("template");
    setBotId(selectedBot);
    setFlowId(selectedFlow);
    if (!selectedBot || !selectedFlow) {
      const template = selectedTemplate ? flowTemplates.find((item) => item.id === selectedTemplate) : undefined;
      const next = template ? createTemplateGraph(template) : emptyGraph;
      graphRef.current = next;
      setNodes(next.nodes); setEdges(next.edges); setFlowName(template?.title || "New workflow"); setVersion(0); setPublished(false); setSaved(!template); setSyncState(template ? "Template ready to configure" : selectedBot ? "New workflow" : "Local draft");
      if (template) setSelectedId(next.nodes[0]?.id ?? "");
      return;
    }
    void chattyRequest(`/api/flow-builder/versions?bot_id=${encodeURIComponent(selectedBot)}`).then(async (response) => {
      if (response.status === 401) {
        setAuthState("required");
        setSyncState("Authentication required");
        return;
      }
      if (!response.ok) throw new Error(`Sync failed (${response.status})`);
      const payload = await response.json() as { versions?: Array<{ id: string; flow_id?: string; flow_name?: string; version: number; flow_data: FlowData; status: string }> };
      const latest = payload.versions?.find((item) => !selectedFlow || item.flow_id === selectedFlow);
      if (!latest?.flow_data) return;
       const next = { nodes: latest.flow_data.nodes ?? [], edges: latest.flow_data.edges ?? [], paths: latest.flow_data.paths ?? [] };
      graphRef.current = next; setNodes(next.nodes); setEdges(next.edges); setFlowId(latest.flow_id || selectedFlow); setFlowName(latest.flow_name || "New workflow"); setVersion(latest.version); setPublished(latest.status === "published"); setSaved(true); setSyncState("Synced from Chatty"); historyRef.current = []; futureRef.current = []; setHistorySize(0); setFutureSize(0);
    }).catch(() => setSyncState("Unable to sync workflow"));
  }, []);

  useEffect(() => {
    if (!botId) { setConnections([]); return; }
    let active = true;
    void chattyRequest(`/api/flow-builder/connections?bot_id=${encodeURIComponent(botId)}`).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { connections?: FlowConnection[] };
      if (active) setConnections(payload.connections ?? []);
    }).catch(() => { if (active) setConnections([]); });
    return () => { active = false; };
  }, [botId]);

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
    if (busyAction) return;
    if (!botId) { setSaved(true); setSyncState("Local draft"); return; }
    if (publish && validationIssues.length > 0) { setSyncState("Fix validation errors before publishing"); return; }
    setBusyAction(publish ? "publish" : "save");
    setSyncState(publish ? "Publishing…" : "Saving…");
    try {
      const body = { bot_id: botId, flow_id: flowId, name: flowName.trim() || "New workflow", version: version || 1, flow_data: persistedGraph(graphRef.current), note: publish ? "Published from Chatty Flow Builder" : "Saved from Chatty Flow Builder" };
      const response = await chattyRequest(publish ? "/api/flow-builder/publish" : "/api/flow-builder/versions", { method: "POST", body: JSON.stringify(body) });
      if (response.status === 401) { setAuthState("required"); setSyncState("Authentication required"); setTestError("Your Chatty session expired. Reopen the builder from Chatty to reconnect."); return; }
      if (!response.ok) { const detail = await response.text(); setSyncState(`${publish ? "Publish" : "Save"} failed (${response.status})`); setTestError(detail.slice(0, 220)); return; }
      const result = await response.json() as { version?: number; flow_id?: string };
      if (result.flow_id) {
        setFlowId(result.flow_id);
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("flow_id", result.flow_id);
        nextUrl.searchParams.delete("new");
        nextUrl.searchParams.delete("template");
        window.history.replaceState({}, "", nextUrl.toString());
      }
      if (result.version) setVersion(result.version);
      setSaved(true); setPublished(publish); setSyncState(publish ? "Published to Chatty" : "Saved to Chatty");
    } catch { setSyncState(`${publish ? "Publish" : "Save"} failed: network error`); }
    finally { setBusyAction(null); }
  }

  async function runTest() {
    if (busyAction) return;
    setBusyAction("test");
    setRunning(true); setTestError(null); setTestTrace([]);
    if (!botId) { setTestError("Open this builder from a Chatty bot to run a tenant-authorized test."); setBusyAction(null); return; }
    try {
      const response = await chattyRequest("/api/flow-builder/test", { method: "POST", body: JSON.stringify({ bot_id: botId, flow_id: flowId, flow_data: persistedGraph(graphRef.current) }) });
      const body = await response.json() as { detail?: string; trace?: FlowRunTrace[] };
      if (response.status === 401) { setAuthState("required"); setTestError("Your Chatty session expired. Reopen the builder from Chatty to reconnect."); return; }
      if (!response.ok) { setTestError(body.detail || "The flow test failed."); return; }
      const trace = body.trace || []; setTestTrace(trace);
      const traceById = new Map(trace.map((step) => [step.node_id, step]));
      setNodes((current) => current.map((node) => ({ ...node, executionState: traceById.has(node.id) ? "completed" : "idle", lastError: undefined })));
    } catch { setTestError("The flow test could not reach Chatty."); }
    finally { setBusyAction(null); }
  }

  function addNode(item: NodeDefinition) {
    const id = `${item.type.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${Date.now()}`;
    const parent = pendingParentId ? graphRef.current.nodes.find((node) => node.id === pendingParentId) : undefined;
    const pathId = pendingParentId ? pendingPathId : item.kind === "trigger" ? id : "main";
    const pathTitle = pendingParentId && pendingPathId !== "main" ? `Path ${String.fromCharCode(65 + graphRef.current.nodes.filter((node) => node.pathId && node.pathId !== "main").length)}` : "Main path";
    const newNode: FlowNode = { id, type: item.type, kind: item.kind, title: item.title, subtitle: item.subtitle, icon: item.icon, color: item.color, x: parent ? parent.x + 380 : 180 + ((nodes.length * 44) % 360), y: parent ? parent.y : 110 + ((nodes.length * 54) % 300), provider: item.provider, credentialType: item.credentialType, n8nType: item.n8nType, n8nTypeVersion: item.n8nTypeVersion, n8nParameters: {}, operations: item.operations, config: { ...item.defaultConfig, provider: item.provider, retry_enabled: "true", idempotency_enabled: "true" }, pathId, pathTitle, stepIndex: parent ? (parent.stepIndex ?? 0) + 1 : 0 };
    const nextEdges = parent ? [...graphRef.current.edges, { from: parent.id, to: id, label: pendingPathId === "main" ? undefined : pathTitle }] : graphRef.current.edges;
    const nextPaths = [...(graphRef.current.paths ?? [])];
    if (!nextPaths.some((path) => path.id === pathId)) nextPaths.push({ id: pathId, title: pathTitle, color: item.color });
    setGraph({ nodes: [...graphRef.current.nodes, newNode], edges: nextEdges, paths: nextPaths }); setSelectedId(id); setPendingParentId(null); setPendingPathId("main"); setMobilePanel(null);
  }

  function replaceWithTemplate(template: FlowTemplate) {
    const graph = createTemplateGraph(template);
    setGraph(graph, true);
    setSelectedId(graph.nodes[0]?.id ?? "");
    setFlowName(template.title);
    setSyncState("Template ready to configure");
    setLibraryView("nodes");
    setPendingTemplate(null);
    setMobilePanel(null);
  }

  function applyTemplate(template: FlowTemplate) {
    if (nodes.length > 0) {
      setPendingTemplate(template);
      return;
    }
    replaceWithTemplate(template);
  }

  function updateNode(nodeId: string, update: Partial<FlowNode>) { setGraph({ nodes: graphRef.current.nodes.map((node) => node.id === nodeId ? { ...node, ...update } : node), edges: graphRef.current.edges, paths: graphRef.current.paths }); }
  function updateConfig(key: string, value: string) { if (selected) updateNode(selected.id, { config: { ...selected.config, [key]: value } }); }
  function removeNode(nodeId: string) { setGraph({ nodes: graphRef.current.nodes.filter((node) => node.id !== nodeId), edges: graphRef.current.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId), paths: graphRef.current.paths }); setSelectedId(""); setNodeMenuId(null); }
  function duplicateNode(node: FlowNode) { const id = `${node.id}-copy-${Date.now()}`; setGraph({ nodes: [...graphRef.current.nodes, { ...node, id, title: `${node.title} copy`, x: node.x + 36, y: node.y + 36, config: { ...node.config } }], edges: graphRef.current.edges, paths: graphRef.current.paths }); setSelectedId(id); setNodeMenuId(null); }
  function connectNodes(sourceId: string, targetId: string) { if (sourceId === targetId || graphRef.current.edges.some((edge) => edge.from === sourceId && edge.to === targetId)) return; setGraph({ nodes: graphRef.current.nodes, edges: [...graphRef.current.edges, { from: sourceId, to: targetId }], paths: graphRef.current.paths }); }
  function moveNodes(nextNodes: FlowNode[]) { setGraph({ nodes: nextNodes, edges: graphRef.current.edges, paths: graphRef.current.paths }); }
  function changeEdges(nextEdges: FlowEdge[]) { setGraph({ nodes: graphRef.current.nodes, edges: nextEdges, paths: graphRef.current.paths }); }
  function openAddStep(parentId: string, branch = false) { setPendingParentId(parentId); setPendingPathId(branch ? `path-${Date.now()}` : "main"); setLibraryView("nodes"); setMobilePanel("palette"); window.setTimeout(() => document.querySelector<HTMLInputElement>(".search input")?.focus(), 0); }

  async function handleN8nImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setBusyAction("import");
    try { const imported = importN8nWorkflow(JSON.parse(await file.text())); setGraph(imported, true); setSelectedId(imported.nodes[0]?.id ?? ""); setSyncState("Imported n8n draft"); } catch (error) { setTestError(error instanceof Error ? error.message : "The n8n workflow could not be imported."); setRunning(true); }
    finally { setBusyAction(null); }
  }

  function downloadN8n() {
    const blob = new Blob([JSON.stringify(exportN8nWorkflow(persistedGraph(graphRef.current)), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${(flowName || "chatty-workflow").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function startOAuth(provider: string) {
    if (!botId) { setTestError("Open this editor from a Chatty bot before connecting a provider."); return; }
    setConnectingProvider(provider);
    setBusyAction("save");
    try {
      const redirectPath = `/flow?bot_id=${encodeURIComponent(botId)}${flowId ? `&flow_id=${encodeURIComponent(flowId)}` : ""}`;
      const response = await chattyRequest("/api/flow-builder/connections/oauth-start", { method: "POST", body: JSON.stringify({ bot_id: botId, provider, redirect_path: redirectPath }) });
      const body = await response.json() as { url?: string; detail?: string };
      if (!response.ok || !body.url) { setTestError(body.detail || "The provider connection could not start."); return; }
      window.location.assign(body.url);
    } catch { setTestError("The provider connection could not reach Chatty."); }
    finally { setBusyAction(null); setConnectingProvider(null); }
  }

  function saveConnection(connection: FlowConnection) {
    setConnections((current) => [...current.filter((item) => item.id !== connection.id), connection]);
    updateConfig("connection_id", connection.id);
    setConnectionProvider(null);
    setSyncState(`${connection.provider} connection saved`);
  }

  return <main className="builder-shell">
    <input ref={importRef} className="sr-only" aria-hidden="true" tabIndex={-1} type="file" accept="application/json,.json" onChange={(event) => void handleN8nImport(event)} />
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Image src="/chatty_flow.png" alt="" width={22} height={22} priority aria-hidden="true" /></div><div><strong>Chatty Flows</strong><span>Automation workspace</span></div></div>
      <div className="crumb"><a className="flows-link" href={botId ? `/flow?bot_id=${encodeURIComponent(botId)}` : "/flow"}>My flows</a><ChevronDown size={14} /><span className="muted">/</span><input className="workflow-name" value={flowName} onChange={(event) => { setFlowName(event.target.value); setSaved(false); }} aria-label="Workflow name" /><span className="draft-pill"><span className="status-dot" /> {published ? "Published" : "Draft"}</span></div>
      <div className="top-actions"><button type="button" className="icon-btn mobile-only" onClick={() => setMobilePanel("palette")} aria-label="Open node library"><Menu size={18} /></button><button type="button" className="secondary" onClick={() => importRef.current?.click()} disabled={Boolean(busyAction)}>{busyAction === "import" ? <Loader2 className="spin" size={14} /> : <Upload size={14} />} Import n8n</button><button type="button" className="secondary" onClick={downloadN8n} disabled={Boolean(busyAction)}> <Download size={14} /> Export</button><button type="button" className="secondary" onClick={() => void runTest()} disabled={Boolean(busyAction)}>{busyAction === "test" ? <Loader2 className="spin" size={14} /> : <Play size={14} />} Test</button><button type="button" className="secondary save-button" onClick={() => void saveDraft(false)} disabled={(saved && Boolean(botId) && Boolean(flowId)) || Boolean(busyAction)}>{busyAction === "save" ? <Loader2 className="spin" size={14} /> : <Save size={14} />} Save draft</button><button type="button" className="primary" onClick={() => void saveDraft(true)} disabled={validationIssues.length > 0 || Boolean(busyAction)}>{busyAction === "publish" ? <Loader2 className="spin" size={14} /> : <Check size={14} />} Publish</button>{authState === "required" && <span className="auth-state">Authentication required</span>}<div className="account-wrap"><button type="button" className={`avatar ${accountOpen ? "open" : ""}`} aria-label="Account" title="Account" aria-expanded={accountOpen} onClick={() => setAccountOpen((current) => !current)}><UserCircle2 size={18} /></button>{accountOpen && <div className="account-menu"><small>CHATTY AUTH</small><b>{authState === "session" ? "Connected" : authState === "handoff" ? "Connected by handoff" : authState === "checking" ? "Checking connection" : "Authentication required"}</b><span>{authEmail || (authState === "required" ? "Open this builder from Chatty." : "Tenant session active")}</span>{authState === "required" && <a href={process.env.NEXT_PUBLIC_CHATTY_APP_URL ?? "https://app.personaliai.com"}><ExternalLink size={13} /> Open Chatty</a>}<button type="button" onClick={() => { setRefreshingAuth(true); window.location.reload(); }} disabled={refreshingAuth}>{refreshingAuth ? <Loader2 className="spin" size={13} /> : <RotateCcw size={13} />} Refresh connection</button></div>}</div></div>
    </header>
    <div className="workspace">
      {view === "canvas" ? <>
       <FlowLibrary
         libraryView={libraryView}
         search={search}
         sourceFilter={sourceFilter}
         filteredCatalog={filteredCatalog}
         templates={flowTemplates}
         mobileOpen={mobilePanel === "palette"}
         onSetLibraryView={setLibraryView}
         onSearch={setSearch}
         onSourceFilter={setSourceFilter}
         onAddNode={addNode}
         onApplyTemplate={applyTemplate}
         onCloseMobile={() => setMobilePanel(null)}
       />
        <section className="canvas-area">
          <div className="canvas-toolbar"><div className="toolbar-group"><button className="tool-active" onClick={() => setView("canvas")}><LayoutGrid size={15} /> Canvas</button><button onClick={() => setView("history")}><History size={15} /> History</button><span className="toolbar-divider" /><button onClick={undo} disabled={historySize === 0} aria-label="Undo"><Undo2 size={15} /></button><button onClick={redo} disabled={futureSize === 0} aria-label="Redo"><Redo2 size={15} /></button></div><div className="toolbar-group"><button onClick={() => canvasCommandsRef.current?.zoomOut()} aria-label="Zoom out">−</button><button onClick={() => canvasCommandsRef.current?.resetZoom()} className="zoom-reset">100%</button><button onClick={() => canvasCommandsRef.current?.zoomIn()} aria-label="Zoom in">+</button><button onClick={() => canvasCommandsRef.current?.fitView()} aria-label="Fit workflow"><RotateCcw size={14} /></button></div></div>
           <FlowCanvas nodes={nodes} edges={edges} selectedId={selectedId} nodeMenuId={nodeMenuId} onSelect={(nodeId) => { setSelectedId(nodeId); if (nodeId) setMobilePanel("inspector"); }} onNodesChange={moveNodes} onEdgesChange={changeEdges} onConnect={connectNodes} onDuplicate={duplicateNode} onRemove={removeNode} onToggleMenu={(nodeId) => setNodeMenuId(nodeMenuId === nodeId ? null : nodeId)} onAddStep={(nodeId) => openAddStep(nodeId)} onAddBranch={(nodeId) => openAddStep(nodeId, true)} onCreateNode={() => { setLibraryView("nodes"); setMobilePanel("palette"); window.setTimeout(() => document.querySelector<HTMLInputElement>(".search input")?.focus(), 0); }} commandsRef={canvasCommandsRef} />
          <div className="canvas-status"><span><span className={`green-dot ${saved ? "" : "pending"}`} /> {syncState}</span><span>{nodes.length} nodes · {edges.length} connections</span><span className={`status-right ${validationIssues.length ? "has-issues" : ""}`}>{validationIssues.length ? `${validationIssues.length} validation issue${validationIssues.length === 1 ? "" : "s"}` : published ? `Published v${version || 1}` : saved ? "Draft ready" : "Unsaved changes"}</span></div>
        </section>
         <aside className={`inspector ${mobilePanel === "inspector" ? "mobile-open" : ""}`}>
           <div className="panel-head"><div><small>CONFIGURE</small><h2>{selected ? selected.title : "Select a node"}</h2></div><button type="button" className="icon-btn mobile-only" onClick={() => setMobilePanel(null)} aria-label="Close inspector"><X size={17} /></button></div>
           <NodeInspector selected={selected} nodes={nodes} connections={connections} onUpdateNode={updateNode} onUpdateConfig={updateConfig} onConnectNodes={connectNodes} onRemove={removeNode} onOpenConnection={() => { if (selected) setConnectionProvider(getProviderConnection(selected) ?? null); }} onOpenChatty={() => void startOAuth(selected?.provider ?? "")} connectionBusy={Boolean(connectingProvider)} />
           {validationIssues.length > 0 && <div className="validation-box"><div><AlertCircle size={14} /><b>Before publishing</b></div>{validationIssues.slice(0, 4).map((issue) => <p key={issue}>{issue}</p>)}</div>}
         </aside>
      </> : <section className="history-area"><RunHistory runs={runs} loading={runsLoading} selectedRun={selectedRun} onSelect={setSelectedRun} onRefresh={() => setRunsRefresh((value) => value + 1)} onBack={() => setView("canvas")} /></section>}
    </div>
    <footer className="mobile-nav"><button onClick={() => setMobilePanel("palette")}><Plus size={17} /><span>Add</span></button><button className="mobile-run" onClick={() => void runTest()}><Play size={17} /><span>Test</span></button><button onClick={() => setMobilePanel("inspector")}><Settings2 size={17} /><span>Inspect</span></button></footer>
    {running && <div className="modal-backdrop"><div className="run-modal"><div className="modal-title"><div><small>VALIDATION RUN</small><h2>Flow test</h2></div><button className="icon-btn" onClick={() => setRunning(false)}><X size={18} /></button></div>{testError ? <div className="run-error">{testError}</div> : testTrace.length ? testTrace.map((step) => <div className="run-progress" key={step.node_id}><span className="run-icon"><CheckCircle2 size={16} /></span><div><b>{step.title}</b><small>{step.status} · no external side effects</small></div></div>) : <div className="run-progress active"><span className="spinner" /><div><b>Validating graph</b><small>Checking connections and execution order…</small></div></div>}<button className="secondary full" onClick={() => setRunning(false)}>Close test run</button></div></div>}
    {pendingTemplate && <div className="modal-backdrop"><div className="template-confirm"><div className="modal-title"><div><small>USE TEMPLATE</small><h2>Replace this workflow?</h2></div><button type="button" className="icon-btn" onClick={() => setPendingTemplate(null)}><X size={18} /></button></div><p>This replaces the current canvas with “{pendingTemplate.title}”. Unsaved changes will be removed.</p><div className="template-confirm-actions"><button type="button" className="secondary" onClick={() => setPendingTemplate(null)}>Cancel</button><button type="button" className="primary" onClick={() => replaceWithTemplate(pendingTemplate)}>Replace workflow</button></div></div></div>}
    {connectionProvider && <ConnectionModal botId={botId} definition={connectionProvider} onClose={() => setConnectionProvider(null)} onSaved={saveConnection} onStartOAuth={() => void startOAuth(connectionProvider.provider)} />}
  </main>;
}
