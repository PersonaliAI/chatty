"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowRight, CheckCircle2, ExternalLink, Loader2, MoreHorizontal, Plus, RefreshCw, Trash2, Webhook, XCircle } from "lucide-react";
import { chattyRequest } from "./lib";
import { flowTemplates } from "./templates";

type FlowSummary = {
  id: string;
  name: string;
  is_enabled: boolean;
  created_at?: string;
  updated_at?: string;
  latest_version?: number | null;
  latest_status?: "draft" | "published";
  latest_is_enabled?: boolean;
  node_count: number;
  connection_count: number;
  published_at?: string | null;
};

type Props = { botId: string; embedded?: boolean };

const outboundPlatforms = [
  { name: "n8n", description: "Send Chatty events to an n8n Webhook trigger.", tone: "#ff6d5a" },
  { name: "Zapier", description: "Use a Catch Hook to start a Zap from Chatty.", tone: "#f97316" },
  { name: "Make", description: "Use a Custom webhook to start a Make scenario.", tone: "#8b5cf6" },
];

function formatUpdated(value?: string) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)}`;
}

export function FlowManager({ botId, embedded = false }: Props) {
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyFlow, setBusyFlow] = useState<string | null>(null);
  const [menuFlow, setMenuFlow] = useState<string | null>(null);

  const loadFlows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await chattyRequest(`/api/flow-builder/flows?bot_id=${encodeURIComponent(botId)}`);
      const payload = await response.json().catch(() => ({})) as { flows?: FlowSummary[]; detail?: string };
      if (response.status === 401) throw new Error("Your Chatty session is not connected. Reopen Flow Builder from Chatty.");
      if (!response.ok) throw new Error(payload.detail || "Saved flows could not be loaded.");
      setFlows(payload.flows ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Saved flows could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => { void loadFlows(); }, [loadFlows]);

  const publishedCount = useMemo(() => flows.filter((flow) => flow.latest_status === "published" && flow.is_enabled).length, [flows]);

  async function toggleFlow(flow: FlowSummary) {
    setBusyFlow(flow.id);
    setMenuFlow(null);
    try {
      const response = await chattyRequest("/api/flow-builder/state", { method: "PATCH", body: JSON.stringify({ bot_id: botId, flow_id: flow.id, enabled: !flow.is_enabled }) });
      if (!response.ok) throw new Error("The flow state could not be changed.");
      setFlows((current) => current.map((item) => item.id === flow.id ? { ...item, is_enabled: !flow.is_enabled, latest_is_enabled: !flow.is_enabled } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The flow state could not be changed.");
    } finally {
      setBusyFlow(null);
    }
  }

  async function deleteFlow(flow: FlowSummary) {
    if (!window.confirm(`Delete “${flow.name}”? This removes its saved revisions.`)) return;
    setBusyFlow(flow.id);
    setMenuFlow(null);
    try {
      const response = await chattyRequest(`/api/flow-builder/workflow?bot_id=${encodeURIComponent(botId)}&flow_id=${encodeURIComponent(flow.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("The flow could not be deleted.");
      setFlows((current) => current.filter((item) => item.id !== flow.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The flow could not be deleted.");
    } finally {
      setBusyFlow(null);
    }
  }

  const managerUrl = `/flow?bot_id=${encodeURIComponent(botId)}`;
  const editorUrl = (extra = "") => `/flow/builder?bot_id=${encodeURIComponent(botId)}${extra}`;

  return <main className={`flow-manager-shell${embedded ? " flow-manager-embedded" : ""}`}>
    <header className="flow-manager-topbar">
      <a className="flow-manager-brand" href={managerUrl}><span className="brand-mark"><Image src="/chatty_flow.png" alt="" width={22} height={22} priority aria-hidden="true" /></span><span><strong>Chatty Flows</strong><small>Automation workspace</small></span></a>
      <div className="flow-manager-top-actions"><button type="button" className="manager-secondary" onClick={() => void loadFlows()} disabled={loading}>{loading ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} Refresh</button><a className="manager-primary" href={editorUrl("&new=1")}><Plus size={16} /> New workflow</a></div>
    </header>

    <div className="flow-manager-content">
      <div className="flow-manager-heading"><div><small>WORKSPACE</small><h1>My flows</h1><p>Build Chatty conversations, publish them, and control which automations are live.</p></div><div className="flow-manager-stats"><span><b>{flows.length}</b> total</span><span><b>{publishedCount}</b> live</span></div></div>

      {error && <div className="flow-manager-alert"><XCircle size={17} /><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}

      <section className="flow-manager-section"><div className="section-heading"><div><h2>Created flows</h2><p>Only flows saved to this Chatty bot appear here.</p></div></div>
        {loading ? <div className="flow-manager-loading"><Loader2 className="spin" size={18} /> Loading saved flows…</div> : flows.length === 0 ? <div className="flow-manager-empty"><span className="flow-manager-empty-icon"><Webhook size={22} /></span><h3>No flows yet</h3><p>Create your first Chatty flow or start from a focused template. Unsaved canvases are not listed here.</p><a className="manager-primary" href={editorUrl("&new=1")}><Plus size={16} /> Create workflow</a></div> : <div className="flow-card-grid">{flows.map((flow) => <article className="flow-summary-card" key={flow.id}><div className="flow-card-top"><span className={`flow-status ${flow.is_enabled && flow.latest_status === "published" ? "live" : "draft"}`}><span className="status-dot" />{flow.is_enabled && flow.latest_status === "published" ? "Live" : "Draft"}</span><div className="flow-menu-wrap"><button type="button" className="flow-menu-button" aria-label={`Actions for ${flow.name}`} onClick={() => setMenuFlow((current) => current === flow.id ? null : flow.id)}><MoreHorizontal size={17} /></button>{menuFlow === flow.id && <div className="flow-card-menu"><button type="button" onClick={() => void toggleFlow(flow)}>{flow.is_enabled ? "Pause flow" : "Enable flow"}</button><button type="button" className="danger" onClick={() => void deleteFlow(flow)}><Trash2 size={13} /> Delete flow</button></div>}</div></div><h3>{flow.name}</h3><p className="flow-card-meta">{formatUpdated(flow.updated_at || flow.created_at)}</p><div className="flow-card-stats"><span>{flow.node_count} nodes</span><span>{flow.connection_count} connections</span><span>v{flow.latest_version ?? 0}</span></div><div className="flow-card-footer"><a href={editorUrl(`&flow_id=${encodeURIComponent(flow.id)}`)}>Open editor <ArrowRight size={14} /></a><button type="button" className="flow-toggle" onClick={() => void toggleFlow(flow)} disabled={busyFlow === flow.id}>{busyFlow === flow.id ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />} {flow.is_enabled ? "Enabled" : "Paused"}</button></div></article>)}</div>}
      </section>

      <section className="flow-manager-section outbound-section"><div className="section-heading"><div><h2>Connect Chatty to automation platforms</h2><p>These platforms are outbound destinations. They do not appear as native Chatty nodes.</p></div><a href="/dashboard?tab=developer" className="manager-link">Manage webhooks <ExternalLink size={14} /></a></div><div className="outbound-grid">{outboundPlatforms.map((platform) => <div className="outbound-card" key={platform.name}><span className="outbound-logo" style={{ color: platform.tone }}>{platform.name.slice(0, 1)}</span><div><h3>{platform.name}</h3><p>{platform.description}</p><span>Signed Chatty webhook</span></div></div>)}</div></section>

      <section className="flow-manager-section template-section"><div className="section-heading"><div><h2>Start from a Chatty template</h2><p>Templates add real Chatty nodes to a new canvas. You must review and save them.</p></div></div><div className="manager-template-grid">{flowTemplates.slice(0, 3).map((template) => <a className="manager-template-card" key={template.id} href={editorUrl(`&new=1&template=${encodeURIComponent(template.id)}`)}><span style={{ color: template.color }}>{template.icon === "spark" ? "✦" : "+"}</span><div><h3>{template.title}</h3><p>{template.description}</p></div><ArrowRight size={15} /></a>)}</div></section>
    </div>
  </main>;
}
