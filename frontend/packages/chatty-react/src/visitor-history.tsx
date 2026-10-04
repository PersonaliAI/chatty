"use client";
import { useEffect, useState } from "react";
import type { VisitorIdentityClient } from "./visitor-identity";

export function VisitorHistory({ identity, onSelect, onNew }: { identity: VisitorIdentityClient; onSelect: (session: string) => void; onNew?: () => void }) {
  const [conversations, setConversations] = useState<Array<{ session_id: string; channel: string; last_message: string }>>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    void identity.fetch(`${identity.backend}/api/widget/identity/history?bot_id=${encodeURIComponent(identity.botId)}`)
      .then(async response => { if (!response.ok) throw new Error("History unavailable"); return response.json(); })
      .then(body => { if (alive) setConversations(body.conversations || []); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [identity]);
  return <section aria-label="Conversation history" className="space-y-2">
    <h3 className="text-xs font-semibold">Your conversations</h3>
    {error && <p className="text-xs">History unavailable. Reload to retry.</p>}
    {conversations.map(conversation => <button key={conversation.session_id} type="button" className="widget-card w-full text-left p-3 text-xs" onClick={() => onSelect(conversation.session_id)}><span className="font-semibold">{conversation.channel === "voice" ? "Voice" : "Text"}</span><span className="block truncate mt-1">{conversation.last_message || "Conversation"}</span></button>)}
    <button type="button" className="widget-card w-full p-3 text-xs" onClick={() => onNew ? onNew() : void identity.newConversation()}>New conversation</button>
  </section>;
}
