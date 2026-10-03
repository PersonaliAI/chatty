"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, Edit3, MoreHorizontal, Pause, Play, Plus, RefreshCw, Trash2, Workflow, X, Zap } from "lucide-react";
import { fetchBackend } from "@/lib/backend-client";
import { createClient } from "@/lib/supabase/client";

type FlowVersion = {
  id: string;
  bot_id: string;
  flow_id?: string | null;
  flow_name?: string;
  version: number;
  status: "draft" | "published";
  is_enabled?: boolean;
  flow_data?: { nodes?: Array<{ title?: string }> };
  note?: string | null;
  created_at?: string;
};

type Props = { botId: string | null; onCreate?: () => void };

function flowName(flow: FlowVersion) {
  return flow.flow_name || flow.flow_data?.nodes?.[0]?.title || flow.note || "Chatty automation";
}

export function FlowBuilderAutomationTab({ botId, onCreate }: Props) {
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const latest = useMemo(() => {
    const map = new Map<string, FlowVersion>();
    for (const item of versions) {
      const current = map.get(item.flow_id || item.bot_id);
      if (!current || item.version > current.version) map.set(item.flow_id || item.bot_id, item);
    }
    return [...map.values()];
  }, [versions]);

  async function load() {
    if (!botId) return;
    setLoading(true);
    try {
      const response = await fetchBackend(createClient(), "/api/flow-builder/versions?bot_id=" + encodeURIComponent(botId));
      const body = response.ok ? await response.json() as { versions?: FlowVersion[] } : {};
      setVersions(body.versions || []);
    } catch {
      setMessage("Could not load automations right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [botId]);

  async function openBuilder(flow?: FlowVersion) {
    if (!botId) return;
    const response = await fetchBackend(createClient(), "/api/flow-builder/handoff?bot_id=" + encodeURIComponent(botId), { method: "POST" });
    const body = response.ok ? await response.json() as { handoff?: string } : {};
    const params = new URLSearchParams({ bot_id: botId });
    if (flow?.flow_id) params.set("flow_id", flow.flow_id);
    if (flow?.version) params.set("version", String(flow.version));
    if (body.handoff) params.set("handoff", body.handoff);
    const builderUrl = process.env.NEXT_PUBLIC_FLOW_BUILDER_URL || "https://flow.personaliai.com";
    window.open(builderUrl + "?" + params.toString(), "_blank", "noopener,noreferrer");
  }

  async function setEnabled(flow: FlowVersion, enabled: boolean) {
    setWorking(flow.id);
    const response = await fetchBackend(createClient(), "/api/flow-builder/state", { method: "PATCH", body: JSON.stringify({ bot_id: flow.bot_id, flow_id: flow.flow_id, enabled }) });
    if (response.ok) {
      setVersions((current) => current.map((item) => item.id === flow.id ? { ...item, is_enabled: enabled } : item));
      setMessage(enabled ? "Automation resumed." : "Automation paused.");
    } else setMessage("The automation state could not be changed.");
    setWorking(null);
    setMenu(null);
  }

  async function remove(flow: FlowVersion) {
    if (!window.confirm("Delete " + flowName(flow) + "? This removes its saved versions.")) return;
    setWorking(flow.id);
    const query = new URLSearchParams({ bot_id: flow.bot_id });
    if (flow.flow_id) query.set("flow_id", flow.flow_id);
    const response = await fetchBackend(createClient(), "/api/flow-builder/workflow?" + query.toString(), { method: "DELETE" });
    if (response.ok) { setVersions([]); setMessage("Automation deleted."); } else setMessage("The automation could not be deleted.");
    setWorking(null);
    setMenu(null);
  }

  return <section className="flow-automation-tab" aria-label="Chatty automations">
    <div className="flow-automation-head"><div><div className="eyebrow"><Zap className="size-3.5" /> AUTOMATIONS</div><h3>Workflow automations</h3><p>Connect Chatty events to CRM, messaging, AI, and business tools.</p></div><div className="flow-automation-head-actions"><button className="flow-refresh" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={14} /> Refresh</button><button className="flow-create" onClick={() => { onCreate?.(); void openBuilder(); }}><Plus size={15} /> New workflow</button></div></div>
    {message && <div className="flow-notice"><Activity size={14} />{message}<button onClick={() => setMessage(null)}><X size={14} /></button></div>}
    {loading ? <div className="flow-skeleton"><div /><div /><div /></div> : latest.length === 0 ? <div className="flow-empty"><div className="flow-empty-icon"><Workflow size={26} /></div><h4>No workflows yet</h4><p>Start with a Chatty event, then add conditions and actions from the node library.</p><button className="flow-create" onClick={() => void openBuilder()}><Plus size={15} /> Build your first workflow</button></div> : <div className="flow-table-wrap"><div className="flow-table-label">WORKFLOWS <span>{latest.length}</span></div><div className="flow-table">{latest.map((flow) => <article className="flow-row" key={flow.id}><div className="flow-row-main"><div className="flow-row-icon"><Workflow size={18} /></div><div><h4>{flowName(flow)}</h4><p>Version {flow.version} · {flow.flow_data?.nodes?.length || 0} nodes · Updated {flow.created_at ? new Date(flow.created_at).toLocaleDateString() : "recently"}</p></div></div><div className="flow-row-status"><span className={"flow-status " + (flow.status === "published" && flow.is_enabled !== false ? "active" : flow.status === "published" ? "paused" : "draft")}><span />{flow.status === "published" && flow.is_enabled !== false ? "Active" : flow.status === "published" ? "Paused" : "Draft"}</span></div><div className="flow-row-actions"><button onClick={() => void openBuilder(flow)}><Edit3 size={14} /> Edit</button><button onClick={() => void setEnabled(flow, flow.is_enabled === false)} disabled={working === flow.id}>{flow.is_enabled === false ? <Play size={14} /> : <Pause size={14} />}{flow.is_enabled === false ? "Resume" : "Pause"}</button><button className="more" onClick={() => setMenu(menu === flow.id ? null : flow.id)} aria-label="More workflow actions"><MoreHorizontal size={16} /></button>{menu === flow.id && <div className="flow-menu"><button onClick={() => void openBuilder(flow)}><ArrowUpRight size={14} /> Open builder</button><button className="danger" onClick={() => void remove(flow)}><Trash2 size={14} /> Delete workflow</button></div>}</div></article>)}</div></div>}
  </section>;
}
