"use client";

import { useSearchParams } from "next/navigation";
import FlowBuilderScreen from "./flow-builder/flow-builder-screen";
import { FlowManager } from "./flow-builder/flow-manager";

export default function FlowRoute() {
  const searchParams = useSearchParams();
  const botId = searchParams.get("bot_id") || searchParams.get("botId");
  const flowId = searchParams.get("flow_id");
  const isNew = searchParams.get("new") === "1" || Boolean(searchParams.get("template"));

  if (botId && !flowId && !isNew) return <FlowManager botId={botId} />;
  return <FlowBuilderScreen />;
}
