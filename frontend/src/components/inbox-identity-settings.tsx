"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";

export function InboxIdentitySettings({ botId, fetchBackend }: {
  botId: string;
  fetchBackend: (path: string, options?: RequestInit) => Promise<Response>;
}) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(384, window.innerWidth - 32);
    setPosition({
      top: rect.bottom + 8,
      left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)),
    });
  };
  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
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
    <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-expanded={open} title="Website identity setup" className="inbox-identity-trigger inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => { setOpen(value => !value); setSecret(null); setError(""); }}>
      <ShieldCheck className="size-3.5 shrink-0" />
      <span>Website identity setup</span>
    </button>
    {open && typeof document !== "undefined" && createPortal(<section aria-label="Website identity setup" className="fixed z-[9990] w-[min(24rem,calc(100vw-2rem))] p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl max-h-[75vh] overflow-y-auto" style={{ top: position.top, left: position.left }}>
      <h3 className="font-semibold mb-2">Secure website identification</h3>
      <p className="mb-3">Sign customer identity on your website server, after checking its authenticated session. Never put this secret in browser code. Emails alone do not verify a customer.</p>
      <a className="underline" href="https://github.com/PersonaliAI/chatty/blob/main/docs/INBOX_IDENTITY_SETUP.md" target="_blank" rel="noopener noreferrer">Setup and server-side example</a>
      <button type="button" disabled={busy} className="block my-3 px-3 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-black" onClick={() => void rotate()}>{busy ? "Generating…" : "Generate / rotate signing secret"}</button>
      {error && <p role="alert">{error}</p>}
      {secret && <><p>Shown only for this operation. Save it in your server’s secret manager.</p><textarea aria-label="Website signing secret" readOnly value={secret} className="w-full my-2 border rounded p-2 font-mono break-all" /><button type="button" className="underline" onClick={() => void navigator.clipboard.writeText(secret)}>Copy secret</button></>}
      <button type="button" className="block mt-3 underline" onClick={() => { setOpen(false); setSecret(null); }}>Close and clear</button>
    </section>, document.body)}
  </div>;
}
