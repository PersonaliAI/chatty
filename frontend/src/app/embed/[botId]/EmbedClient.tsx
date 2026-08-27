"use client";

import { useSearchParams } from "next/navigation";
import ChatWidgetCore from "./ChatWidgetCore";

interface EmbedClientProps {
  botId: string;
  originToken: string | null;
}

export default function EmbedClient({ botId, originToken }: EmbedClientProps) {
  const searchParams = useSearchParams();

  return (
    <ChatWidgetCore
      botId={botId}
      originToken={originToken}
      isPreview={searchParams.get("preview") === "true"}
      paramColor={searchParams.get("color")}
      paramStyle={searchParams.get("style")}
      paramName={searchParams.get("name")}
      paramWelcome={searchParams.get("welcome")}
      paramAvatarIcon={searchParams.get("avatar_icon")}
      paramAvatarUrl={searchParams.get("avatar_url")}
      paramLogoUrl={searchParams.get("logo_url")}
      paramLogoBgColor={searchParams.get("logo_bg_color")}
      paramShowSenderTag={searchParams.get("show_sender_tag")}
      paramCsatEnabled={searchParams.get("csat_enabled")}
      paramColorScheme={searchParams.get("color_scheme")}
    />
  );
}
