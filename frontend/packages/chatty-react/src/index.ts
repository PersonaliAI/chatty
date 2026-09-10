"use client";

import React, { useEffect, useCallback } from "react";

export interface ChattyWidgetProps {
  /**
   * Your bot's unique UUID from the Chatty dashboard.
   */
  botId: string;
  /**
   * Host URL for widget.js (defaults to "https://chatty.personaliai.com/widget.js").
   */
  widgetUrl?: string;
  /**
   * Corner anchor for the launcher button ("right" | "left"). Defaults to "right".
   */
  position?: "right" | "left";
  /**
   * Hex color override for launcher button (e.g. "#4F46E5").
   */
  color?: string;
  /**
   * Widget visual style preset ("minimal", "playful", "corporate", etc.).
   */
  style?: string;
  /**
   * Whether to preserve desktop floating panel layout on mobile (defaults to true).
   */
  mobileFullscreen?: boolean;
  /**
   * Whether to display the proactive greeting teaser bubble (defaults to true).
   */
  teaser?: boolean;
  /**
   * Whether to play notification audio chimes on new AI replies (defaults to true).
   */
  sound?: boolean;
}

export interface ChattyAPI {
  open: () => void;
  close: () => void;
  toggle: () => void;
}

declare global {
  interface Window {
    Chatty?: ChattyAPI;
    __chattyWidgetLoaded?: boolean;
    CHATTY_BOT_ID?: string;
  }
}

/**
 * Official React component for Chatty.
 *
 * Mounts the Chatty AI chat assistant into your application using the lightweight
 * script method into an isolated Shadow DOM container.
 *
 * @example
 * ```tsx
 * import { ChattyWidget } from "@personaliai/react-widget";
 *
 * export default function App() {
 *   return <ChattyWidget botId="your-bot-uuid" position="right" color="#4F46E5" />;
 * }
 * ```
 */
export function ChattyWidget({
  botId,
  widgetUrl = "https://chatty.personaliai.com/widget.js",
  position = "right",
  color,
  style,
  mobileFullscreen = true,
  teaser = true,
  sound = true,
}: ChattyWidgetProps): null {
  useEffect(() => {
    if (typeof window === "undefined" || !botId) return;

    // Check if script has already been injected
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-chatty-script="${botId}"], script[src*="widget.js"]`
    );

    if (existing) {
      return;
    }

    const script = document.createElement("script");
    script.src = widgetUrl;
    script.setAttribute("data-id", botId);
    script.setAttribute("data-chatty-script", botId);
    script.setAttribute("data-position", position);
    if (color) script.setAttribute("data-color", color);
    if (style) script.setAttribute("data-style", style);
    script.setAttribute("data-mobile-fullscreen", String(mobileFullscreen));
    script.setAttribute("data-teaser", String(teaser));
    script.setAttribute("data-sound", String(sound));
    script.defer = true;

    document.body.appendChild(script);

    return () => {
      // On unmount, close the widget if it's open
      if (typeof window !== "undefined" && window.Chatty) {
        window.Chatty.close();
      }
    };
  }, [botId, widgetUrl, position, color, style, mobileFullscreen, teaser, sound]);

  return null;
}

// Named alias for flexibility
export const ChatWidget = ChattyWidget;
export type ChatWidgetProps = ChattyWidgetProps;

/**
 * Hook to programmatically open, close, or toggle the Chatty chat drawer.
 *
 * @example
 * ```tsx
 * import { useChatty } from "@personaliai/react-widget";
 *
 * export function HelpButton() {
 *   const { open, close, toggle } = useChatty();
 *   return <button onClick={open}>Chat with Support</button>;
 * }
 * ```
 */
export function useChatty() {
  const open = useCallback(() => {
    if (typeof window !== "undefined" && window.Chatty) {
      window.Chatty.open();
    }
  }, []);

  const close = useCallback(() => {
    if (typeof window !== "undefined" && window.Chatty) {
      window.Chatty.close();
    }
  }, []);

  const toggle = useCallback(() => {
    if (typeof window !== "undefined" && window.Chatty) {
      window.Chatty.toggle();
    }
  }, []);

  return { open, close, toggle };
}

export default ChattyWidget;
