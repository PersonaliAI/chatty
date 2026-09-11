import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUp,
  Bot,
  Headphones,
  MessageSquare,
  Send,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";

export const AVATAR_ICONS: Record<string, LucideIcon> = {
  bot: Bot,
  headset: Headphones,
  sparkles: Sparkles,
  message: MessageSquare,
  user: User,
};

export const SEND_BUTTON_STYLES: Record<string, { shape: string; icon: ReactNode; label?: string }> = {
  plane: { shape: "size-7 rounded-full", icon: <Send className="size-3.5" /> },
  arrowUp: { shape: "size-7 rounded-full", icon: <ArrowUp className="size-3.5" /> },
  arrowRight: { shape: "size-7 rounded-full", icon: <ArrowRight className="size-3.5" /> },
  square: { shape: "size-7 rounded-lg", icon: <Send className="size-3.5" /> },
  label: { shape: "h-7 px-3 rounded-full gap-1.5", icon: <Send className="size-3" />, label: "Send" },
};
