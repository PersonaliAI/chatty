"use client";

import { Activity, Bot, CalendarDays, Clock3, Code2, Database, GitBranch, Globe2, Mail, MessageSquare, Sparkles, Webhook, Zap } from "lucide-react";

export function NodeIcon({ icon, size = 17 }: { icon: string; size?: number }) {
  const props = { size, strokeWidth: 2 };
  if (icon === "chatty") return <Bot {...props} />;
  if (icon === "webhook") return <Webhook {...props} />;
  if (icon === "globe") return <Globe2 {...props} />;
  if (icon === "branch") return <GitBranch {...props} />;
  if (icon === "clock") return <Clock3 {...props} />;
  if (icon === "spark") return <Sparkles {...props} />;
  if (icon === "sheet" || icon === "crm") return <Database {...props} />;
  if (icon === "calendar") return <CalendarDays {...props} />;
  if (icon === "mail") return <Mail {...props} />;
  if (icon === "slack" || icon === "discord") return <MessageSquare {...props} />;
  if (icon === "zapier" || icon === "n8n") return <Zap {...props} />;
  if (icon === "make") return <Activity {...props} />;
  return <Code2 {...props} />;
}
