"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { FlowManager } from "./flow-builder/flow-manager";

export default function FlowRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const botId = searchParams.get("bot_id") || searchParams.get("botId");
  const query = searchParams.toString();
  const hasLegacyEditorParams = Boolean(searchParams.get("flow_id") || searchParams.get("new") === "1" || searchParams.get("template"));

  useEffect(() => {
    if (hasLegacyEditorParams) router.replace(`/flow/builder?${query}`);
  }, [hasLegacyEditorParams, query, router]);

  // Keep older bookmarks and OAuth callbacks working after the editor moves to
  // its own route. The route replacement is client-side and preserves every
  // query parameter.
  if (hasLegacyEditorParams) {
    return <RouteState message="Opening Flow Builder" />;
  }

  if (!botId) {
    return (
      <RouteState
        message="Select a Chatty bot from the dashboard to view its flows."
        href="/dashboard"
        linkLabel="Back to dashboard"
      />
    );
  }

  return <FlowManager botId={botId} />;
}

function RouteState({ message, href, linkLabel }: { message: string; href?: string; linkLabel?: string }) {
  return (
    <main className="flow-route-state">
      <Loader2 className="spin" size={20} aria-hidden="true" />
      <p>{message}</p>
      {href && linkLabel ? <a href={href}>{linkLabel}</a> : null}
    </main>
  );
}
