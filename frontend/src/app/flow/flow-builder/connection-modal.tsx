"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { chattyRequest } from "./lib";
import type { ProviderConnectionDefinition } from "./connections";
import type { FlowConnection } from "./types";

type Props = {
  botId: string | null;
  definition: ProviderConnectionDefinition;
  onClose: () => void;
  onSaved: (connection: FlowConnection) => void;
  onStartOAuth: () => void;
};

export function ConnectionModal({ botId, definition, onClose, onSaved, onStartOAuth }: Props) {
  const [name, setName] = useState(`${definition.provider} connection`);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const oauth = Boolean(definition.oauthStartPath);

  async function save() {
    if (!botId) { setError("Open this editor from a Chatty bot before adding a connection."); return; }
    if (!name.trim() || definition.fields.some((field) => field.required && !values[field.key]?.trim())) { setError("Complete the required connection fields."); return; }
    setBusy(true); setError("");
    try {
      const response = await chattyRequest("/api/flow-builder/connections", { method: "POST", body: JSON.stringify({ bot_id: botId, provider: definition.provider, name: name.trim(), auth_type: definition.authType, credentials: values }) });
      const body = await response.json() as { connection?: FlowConnection; detail?: string };
      if (!response.ok || !body.connection) { setError(body.detail || "The connection could not be saved."); return; }
      onSaved(body.connection);
    } catch { setError("The connection could not reach Chatty."); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop"><section className="connection-modal" role="dialog" aria-modal="true" aria-labelledby="connection-title">
    <div className="modal-title"><div><small>PROVIDER CONNECTION</small><h2 id="connection-title">{definition.title}</h2></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
    <p className="connection-modal-copy">{definition.description} Chatty encrypts credentials before storage and never sends them back to the browser.</p>
    {oauth ? <div className="oauth-connect-card"><div className="oauth-connect-icon"><Check size={18} /></div><div><b>Use Chatty OAuth</b><span>Authorise {definition.provider} in a secure provider window.</span></div><button type="button" className="secondary" onClick={onStartOAuth}><ExternalLink size={14} /> Connect</button></div> : <><label>Connection name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="My workspace" /></label>{definition.fields.map((field) => <label key={field.key}>{field.label}{field.required && <span className="required-mark"> *</span>}<input type={field.type} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} autoComplete="off" />{field.helpText && <small className="field-help">{field.helpText}</small>}</label>)}<button type="button" className="primary full" onClick={() => void save()} disabled={busy}>{busy ? <Loader2 className="spin" size={14} /> : <Check size={14} />} Save connection</button></>}
    {error && <p className="connection-error">{error}</p>}
  </section></div>;
}
