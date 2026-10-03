"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, ExternalLink, Loader2, Settings2, Trash2 } from "lucide-react";
import { getProviderConnection, providerConnectionLabel } from "./connections";
import { findNodeDefinition, type NodeField } from "./node-registry";
import { NodeIcon } from "./node-icon";
import type { FlowConnection, FlowNode } from "./types";

function ModernSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return <div className="modern-select" ref={rootRef}>
    <button type="button" className={`modern-select-trigger ${open ? "open" : ""}`} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((current) => !current)}><span>{value || "Select an option"}</span><ChevronDown size={14} /></button>
    {open && <div className="modern-select-menu" role="listbox" aria-label={label}>{options.map((option) => <button type="button" role="option" aria-selected={option === value} className={option === value ? "selected" : ""} key={option} onClick={() => { onChange(option); setOpen(false); }}>{option}{option === value && <Check size={13} />}</button>)}</div>}
  </div>;
}

function NodeFieldEditor({ field, value, onChange }: { field: NodeField; value: string; onChange: (value: string) => void }) {
  if (field.type === "select") return <ModernSelect label={field.label} value={value} options={field.options ?? []} onChange={onChange} />;
  if (field.type === "textarea" || field.type === "json") return <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={field.type === "json" ? 7 : 4} spellCheck={false} />;
  return <input type={field.type === "url" ? "url" : field.type === "number" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />;
}

type Props = {
  selected: FlowNode | null;
  nodes: FlowNode[];
  connections: FlowConnection[];
  onUpdateNode: (nodeId: string, update: Partial<FlowNode>) => void;
  onUpdateConfig: (key: string, value: string) => void;
  onConnectNodes: (sourceId: string, targetId: string) => void;
  onRemove: (nodeId: string) => void;
  onOpenConnection: () => void;
  onOpenChatty: () => void;
  connectionBusy: boolean;
};

export function NodeInspector({ selected, nodes, connections, onUpdateNode, onUpdateConfig, onConnectNodes, onRemove, onOpenConnection, onOpenChatty, connectionBusy }: Props) {
  const definition = selected ? findNodeDefinition(selected) : undefined;
  const connectionDefinition = selected ? getProviderConnection(selected) : undefined;
  const providerConnections = selected ? connections.filter((connection) => connection.provider === selected.provider && connection.status === "connected") : [];
  const selectedConnection = selected?.config.connection_id ? connections.find((connection) => connection.id === selected.config.connection_id) : undefined;
  const inspectorFields = definition?.fields ?? [{ key: "operation", label: "Operation", type: "text" as const }, { key: "url", label: "Adapter endpoint URL", type: "url" as const, required: selected?.kind === "action", placeholder: "https://..." }];

  if (!selected) return <div className="empty-inspector"><Settings2 size={22} /><p>Select a node to configure its parameters, credentials, retries, and outputs.</p></div>;

  return <div className="inspector-body">
    <div className="selected-summary"><span className="summary-icon" style={{ color: selected.color, background: `${selected.color}16` }}><NodeIcon icon={selected.icon} /></span><div><b>{selected.title}</b><span>{selected.subtitle}</span></div></div>
    <label>Node label<input value={selected.title} onChange={(event) => onUpdateNode(selected.id, { title: event.target.value })} /></label>
    {selected.n8nType && <label>Node type<input value={selected.n8nType} readOnly aria-readonly="true" /></label>}
    <div className="inspector-section"><div className="section-title">Parameters</div>{inspectorFields.map((field) => <label key={field.key}>{field.label}{field.required && <span className="required-mark"> *</span>}<NodeFieldEditor field={field} value={selected.config[field.key] ?? ""} onChange={(value) => onUpdateConfig(field.key, value)} />{field.helpText && <small className="field-help">{field.helpText}</small>}</label>)}</div>
    {connectionDefinition && <div className="inspector-section connection-section"><div className="section-title">Provider connection</div><p className="connection-help">Credentials are encrypted and scoped to this bot.</p>{providerConnections.length > 0 ? <ModernSelect label={`${selected.provider} connection`} value={selectedConnection ? providerConnectionLabel(selectedConnection) : ""} options={providerConnections.map(providerConnectionLabel)} onChange={(value) => { const connection = providerConnections.find((item) => providerConnectionLabel(item) === value); if (connection) onUpdateConfig("connection_id", connection.id); }} /> : <div className="connection-empty">No {selected.provider} connection is available.</div>}<button type="button" className="connection-action" onClick={connectionDefinition.oauthStartPath ? onOpenChatty : onOpenConnection} disabled={connectionBusy}>{connectionBusy ? <Loader2 className="spin" size={14} /> : connectionDefinition.oauthStartPath ? <ExternalLink size={14} /> : <NodeIcon icon={selected.icon} size={14} />}{providerConnections.length > 0 ? "Manage connections" : `Connect ${selected.provider}`}</button>{selected.config.connection_id && !selectedConnection && <small className="required-mark">Select a current connection before publishing.</small>}</div>}
    {selected.n8nType && <div className="inspector-section"><div className="section-title">n8n parameters</div><textarea className="json-editor" value={JSON.stringify(selected.n8nParameters ?? {}, null, 2)} onChange={(event) => { try { onUpdateNode(selected.id, { n8nParameters: JSON.parse(event.target.value) as Record<string, unknown> }); } catch { /* Keep the last valid JSON until the user finishes typing. */ } }} spellCheck={false} rows={8} /></div>}
    <div className="inspector-section"><div className="section-title">Reliability</div><button type="button" className="toggle-row toggle-button" onClick={() => onUpdateConfig("retry_enabled", selected.config.retry_enabled === "true" ? "false" : "true")}><span><b>Retry failed runs</b><small>Three attempts with backoff</small></span><span className={`toggle ${selected.config.retry_enabled !== "false" ? "on" : ""}`} /></button><button type="button" className="toggle-row toggle-button" onClick={() => onUpdateConfig("idempotency_enabled", selected.config.idempotency_enabled === "false" ? "true" : "false")}><span><b>Idempotency key</b><small>Prevent duplicate side effects</small></span><span className={`toggle ${selected.config.idempotency_enabled !== "false" ? "on" : ""}`} /></button></div>
    {selected.kind !== "trigger" && <div className="connect-list"><div className="section-title">Next step</div>{nodes.filter((node) => node.id !== selected.id).map((node) => <button type="button" key={node.id} onClick={() => onConnectNodes(selected.id, node.id)}><NodeIcon icon={node.icon} size={14} />{node.title}<ArrowRight size={14} /></button>)}</div>}
    <button type="button" className="delete-btn" onClick={() => onRemove(selected.id)}><Trash2 size={14} /> Remove node</button>
  </div>;
}
