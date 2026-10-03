"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LockKeyhole, ShieldCheck, X } from "lucide-react";

export function InboxIdentitySettings({ botId, fetchBackend }: {
  botId: string;
  fetchBackend: (path: string, options?: RequestInit) => Promise<Response>;
}) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  async function rotate() {
    if (!window.confirm("Generate a new website signing secret? This revokes existing website visitor credentials for this bot. Update your server before identifying customers again.")) return;
    setBusy(true); setSecret(null); setError("");
    try {
      const response = await fetchBackend("/api/admin/inbox/identity-settings/rotate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bot_id: botId }),
      });
      if (!response.ok) throw new Error(response.status === 403 ? "Only the bot owner can configure identity." : "Could not configure identity. Check the contact migration and backend encryption configuration.");
      const body = await response.json();
      setSecret(body.signing_secret);
    } catch (error) { setError(error instanceof Error ? error.message : "Configuration failed"); }
    finally { setBusy(false); }
  }
  return <div className="relative inline-flex text-xs">
    <button type="button" aria-haspopup="dialog" aria-expanded={open} title="Website identity setup" className="inbox-identity-trigger inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => { setOpen(value => !value); setSecret(null); setError(""); }}>
      <ShieldCheck className="size-3.5 shrink-0" />
      <span>Website identity setup</span>
    </button>
    {open && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-neutral-950/35 p-4 backdrop-blur-[2px] sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="website-identity-title" className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_24px_80px_-20px_rgba(15,23,42,.45)] animate-in fade-in zoom-in-95 duration-150 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start gap-3 border-b border-neutral-100 bg-gradient-to-br from-orange-50 via-white to-white px-5 py-4 dark:border-neutral-800 dark:from-orange-950/30 dark:via-neutral-900 dark:to-neutral-900 sm:px-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-500/12 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300"><LockKeyhole className="size-5" /></span>
            <div className="min-w-0 flex-1"><h3 id="website-identity-title" className="text-sm font-bold text-neutral-900 dark:text-white sm:text-base">Secure website identification</h3><p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">Verify signed customer sessions before showing personal data.</p></div>
            <button type="button" aria-label="Close website identity setup" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200" onClick={() => setOpen(false)}><X className="size-4" /></button>
          </div>
          <div className="space-y-4 p-5 text-xs text-neutral-600 dark:text-neutral-300 sm:p-6">
            <p className="leading-relaxed">Sign customer identity on your website server after checking its authenticated session. Never put this secret in browser code; email addresses alone do not verify a customer.</p>
            <a className="inline-flex items-center font-semibold text-orange-600 underline underline-offset-2 hover:text-orange-700 dark:text-orange-300" href="https://github.com/PersonaliAI/chatty/blob/main/docs/INBOX_IDENTITY_SETUP.md" target="_blank" rel="noopener noreferrer">Read the server-side setup example<span aria-hidden="true" className="ml-1">↗</span></a>
            <div className="rounded-xl border border-orange-200/70 bg-orange-50/70 p-3 text-[11px] text-orange-900 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-200">Rotating the secret immediately revokes existing website visitor credentials for this bot.</div>
            <button type="button" disabled={busy} className="inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200" onClick={() => void rotate()}>{busy ? "Generating secure secret…" : "Generate / rotate signing secret"}</button>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
            {secret && <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20"><p className="text-[11px] text-emerald-800 dark:text-emerald-200">Shown only for this operation. Save it in your server secret manager.</p><textarea aria-label="Website signing secret" readOnly value={secret} className="min-h-20 w-full resize-none rounded-lg border border-emerald-200 bg-white p-2 font-mono text-[11px] text-neutral-800 outline-none dark:border-emerald-900 dark:bg-neutral-950 dark:text-neutral-200" /><button type="button" className="text-[11px] font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-300" onClick={() => void navigator.clipboard.writeText(secret)}>Copy secret</button></div>}
          </div>
          <div className="flex justify-end border-t border-neutral-100 px-5 py-3 dark:border-neutral-800 sm:px-6"><button type="button" className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white" onClick={() => { setOpen(false); setSecret(null); }}>Close and clear</button></div>
        </section>
      </div>, document.body)}
  </div>;
}
