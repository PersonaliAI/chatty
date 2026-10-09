"use client";

import { useEffect, useMemo, useState } from "react";

export interface VisitorIdentity { visitor_token: string; session_id: string; expires_at: string }
export class VisitorIdentityClient {
  value: VisitorIdentity | null = null;
  private controller = new AbortController();
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private retirement = new Set<string>();
  constructor(readonly botId: string, readonly backend: string) {}
  private key() { return `chatty_identity_${this.botId}`; }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private clear(purge = true) {
    this.controller.abort();
    this.controller = new AbortController();
    this.value = null;
    try {
      if (!purge) { this.listeners.forEach(listener => listener()); return; }
      const prefixes = [`chatty_sid_${this.botId}`, `chatty_session_${this.botId}`, `chatty_msgs_${this.botId}`, `chatty_convs_${this.botId}`, `chatty_voice_sid_${this.botId}`];
      for (const key of Object.keys(localStorage)) if (key === this.key() || prefixes.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key);
    } catch { /* storage can be disabled */ }
    this.listeners.forEach(listener => listener());
  }
  private async exchange(identityToken?: string, newConversation = false) {
    const generation = this.generation;
    const old = this.value;
    if (!newConversation) {
      this.clear(Boolean(identityToken) || !old); // Unmount before changing identities.
    }
    const response = await globalThis.fetch(`${this.backend}/api/widget/identity`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(old?.visitor_token ? { "X-Chatty-Visitor": old.visitor_token } : {}) },
      body: JSON.stringify({ bot_id: this.botId, ...(identityToken ? { identity_token: identityToken } : {}), ...(newConversation ? { new_conversation: true } : {}) }),
      cache: "no-store", credentials: "include", signal: this.controller.signal,
    });
    if (!response.ok) throw new Error("Could not establish visitor identity");
    const value: VisitorIdentity = await response.json();
    if (generation !== this.generation) throw new DOMException("Identity operation cancelled", "AbortError");
    if (!/^ci-[a-f0-9-]{36}$/.test(value.session_id) || !/^[A-Za-z0-9_-]{43}$/.test(value.visitor_token)) throw new Error("Invalid visitor identity response");
    this.value = value;
    if (old && identityToken) this.retirement.delete(old.visitor_token);
    // Keep the bearer capability in memory only. The server also sets an
    // HttpOnly cookie so a reload can re-establish the same visitor session.
    try { localStorage.setItem(`chatty_session_${this.botId}`, JSON.stringify({ session_id: value.session_id, expires_at: value.expires_at })); } catch {}
    this.listeners.forEach(listener => listener());
  }
  initialize() {
    return this.serialize(async () => {
      if (this.value) return;
      try {
        const stored = JSON.parse(localStorage.getItem(`chatty_session_${this.botId}`) || "null");
        if (!stored || new Date(stored.expires_at).getTime() <= Date.now()) localStorage.removeItem(`chatty_session_${this.botId}`);
      } catch {}
      try { await this.exchange(); } catch { this.value = null; await this.exchange(); }
    });
  }
  private serialize(action: () => Promise<void>) {
    const next = this.queue.catch(() => {}).then(action);
    this.queue = next;
    return next;
  }
  identify(token: string) {
    if (typeof token !== "string" || !token || token.length > 16000) return Promise.reject(new Error("A server-signed identity token is required"));
    const generation = this.generation;
    return this.serialize(() => {
      if (generation !== this.generation) throw new DOMException("Identity operation cancelled", "AbortError");
      return this.exchange(token);
    });
  }
  newConversation() {
    const generation = this.generation;
    return this.serialize(() => {
      if (generation !== this.generation) throw new DOMException("Identity operation cancelled", "AbortError");
      return this.exchange(undefined, true);
    });
  }
  invalidate() { this.generation++; this.clear(false); }
  logout() {
    // Clear locally synchronously, even when the network is offline.
    const old = this.value;
    this.generation++;
    if (old) this.retirement.add(old.visitor_token);
    this.clear();
    return this.serialize(async () => {
      for (const token of this.retirement) {
        const response = await globalThis.fetch(`${this.backend}/api/widget/identity/logout`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Chatty-Visitor": token },
          body: JSON.stringify({ bot_id: this.botId }), cache: "no-store", credentials: "include",
        });
        if (!response.ok && response.status !== 401) throw new Error("Logout revocation failed; retry before sharing this device");
        this.retirement.delete(token);
      }
      this.clear();
      await this.exchange();
    });
  }
  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!this.value) throw new Error("Visitor identity unavailable");
    const headers = new Headers(init?.headers);
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    // Never send capabilities to external URLs.
    const isBackend = url.origin === new URL(this.backend).origin;
    if (isBackend) headers.set("X-Chatty-Visitor", this.value.visitor_token);
    else headers.delete("X-Chatty-Visitor");
    const signal = init?.signal ? AbortSignal.any([init.signal, this.controller.signal]) : this.controller.signal;
    const response = await globalThis.fetch(input, { ...init, headers, credentials: isBackend ? "include" : init?.credentials, signal, ...(isBackend ? { redirect: "error" as const, cache: "no-store" as const } : {}) });
    signal.throwIfAborted();
    return response;
  };
}

const clients = new Map<string, VisitorIdentityClient>();
export function visitorIdentityClient(botId: string, backend: string) {
  const key = `${backend}:${botId}`;
  let client = clients.get(key);
  if (!client) { client = new VisitorIdentityClient(botId, backend); clients.set(key, client); }
  return client;
}
export function useVisitorIdentity(botId: string, backend: string) {
  const client = useMemo(() => visitorIdentityClient(botId, backend), [botId, backend]);
  const [value, setValue] = useState<VisitorIdentity | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const unsubscribe = client.subscribe(() => { setValue(client.value); setError(false); });
    setValue(client.value);
    setError(false);
    let alive = true;
    void client.initialize().catch(() => { if (alive) setError(true); });
    const storage = (event: StorageEvent) => {
      if (event.key === `chatty_identity_${botId}` && event.newValue !== event.oldValue) {
        // Another tab changed users/logout. Unmount immediately, then revalidate.
        client.invalidate();
        if (alive) setError(true);
      }
    };
    window.addEventListener("storage", storage);
    const message = (event: MessageEvent) => {
      if (window.parent === window || event.source !== window.parent || !document.referrer) return;
      if (event.origin !== new URL(document.referrer).origin || event.data?.bot_id !== botId) return;
      if (event.data?.type === "chatty:identify") void client.identify(event.data.token).catch(() => { if (alive) setError(true); });
      if (event.data?.type === "chatty:logout") void client.logout().catch(() => { if (alive) setError(true); });
    };
    window.addEventListener("message", message);
    return () => { alive = false; unsubscribe(); window.removeEventListener("storage", storage); window.removeEventListener("message", message); };
  }, [client, botId]);
  return { client, value: value === client.value ? value : null, error };
}
