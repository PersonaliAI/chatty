"use client";

import { useState, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import ChatWidgetCore, { type ChatWidgetCoreProps } from "./ChatWidgetCore";
import { getOnColor } from "./color-contrast";
import { normalizeWidgetStyle } from "./widget-style";
import "./standalone.css";
import "katex/dist/katex.min.css";
import {
  Bot,
  Headphones,
  Sparkles,
  MessageSquare,
  MessageCircle,
  User,
  X,
  type LucideIcon,
} from "lucide-react";

const BACKEND_URL =
  (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_BACKEND_URL : undefined) ??
  "https://api.chatty.personaliai.com";

const LAUNCHER_ICONS: Record<string, LucideIcon> = {
  bot: Bot,
  headset: Headphones,
  headphones: Headphones,
  sparkles: Sparkles,
  message: MessageSquare,
  chat: MessageCircle,
  user: User,
};

const LAUNCHER_STYLES: Record<string, { bg: string; radius: string; shadow: string; dot: string }> = {
  minimal: { bg: "#1c1a15", radius: "50%", shadow: "0 6px 16px rgba(0,0,0,.18)", dot: "#f3f2ee" },
  playful: { bg: "#ff8a5c", radius: "50%", shadow: "0 8px 20px rgba(255,138,92,.45)", dot: "#ffffff" },
  corporate: { bg: "#1c2e4a", radius: "10px", shadow: "0 6px 16px rgba(28,46,74,.3)", dot: "#8fb0dc" },
  "dark-sleek": { bg: "#14141a", radius: "50%", shadow: "0 0 24px rgba(0,229,199,.35)", dot: "#00e5c7" },
  "gradient-glow": { bg: "linear-gradient(135deg,#a855f7,#ec4899)", radius: "50%", shadow: "0 10px 26px rgba(168,85,247,.4)", dot: "#ffffff" },
  glassmorphism: { bg: "rgba(255,255,255,.25)", radius: "50%", shadow: "0 8px 24px rgba(0,0,0,.2)", dot: "#ffffff" },
  ecommerce: { bg: "#0f9d8c", radius: "50%", shadow: "0 8px 20px rgba(15,157,140,.35)", dot: "#ffffff" },
  "healthcare-calm": { bg: "#6f9c7d", radius: "50%", shadow: "0 8px 20px rgba(111,156,125,.35)", dot: "#f4f7f3" },
  neubrutalism: { bg: "#111111", radius: "6px", shadow: "5px 5px 0 0 #111111", dot: "#ffde59" },
  "luxury-editorial": { bg: "#161412", radius: "50%", shadow: "0 8px 22px rgba(0,0,0,.3)", dot: "#b08a3e" },
};

// Named presets, not raw pixel props, so a bot owner's saved choice keeps
// working even if these numbers are retuned later. "default" matches this
// widget's original, pre-customization size exactly.
const PANEL_SIZE_PRESETS: Record<string, { width: number; height: number }> = {
  compact: { width: 320, height: 460 },
  default: { width: 380, height: 560 },
  large: { width: 440, height: 660 },
};
const MIN_PANEL_WIDTH = 300;
const MIN_PANEL_HEIGHT = 380;
const MAX_PANEL_WIDTH = 720;
const MAX_PANEL_HEIGHT = 860;

const PANEL_RADIUS: Record<string, string> = {
  minimal: "18px", playful: "28px", corporate: "10px", "dark-sleek": "16px",
  "gradient-glow": "24px", glassmorphism: "20px", ecommerce: "14px",
  "healthcare-calm": "18px", neubrutalism: "4px", "luxury-editorial": "6px",
};

interface TriggerRule {
  type: string;
  value?: string | number;
  message?: string;
}

export interface ChattyWidgetApi {
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export interface StandaloneMountOptions {
  botId: string;
  color?: string | null;
  style?: string | null;
  position?: "left" | "right";
  mobileFullscreen?: boolean;
  teaserEnabled?: boolean;
  soundEnabled?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  // widget.js's documented `window.Chatty.open()/.close()/.toggle()` API —
  // wired through here since the open/closed state lives inside this
  // component, not in widget.js itself.
  onApiReady?: (api: ChattyWidgetApi) => void;
}

export function ChattyStandaloneApp({
  botId,
  color: colorAttr,
  style: styleAttr,
  position = "right",
  mobileFullscreen = true,
  teaserEnabled = true,
  soundEnabled = true,
  onOpen,
  onClose,
  onApiReady,
}: StandaloneMountOptions) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 480 : false
  );

  // The bot owner's saved default (from the Customizer's "Chat Window Size"
  // setting); customSize overrides it once a visitor drags the resize
  // handle, for this browser tab's lifetime only — not persisted, so the
  // widget starts back at the owner's default on the visitor's next visit.
  const [panelSize, setPanelSize] = useState("default");
  const [customSize, setCustomSize] = useState<{ width: number; height: number } | null>(null);
  const resizeDragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const [currentDesign, setCurrentDesign] = useState(() => normalizeWidgetStyle(styleAttr));
  const [launcherBg, setLauncherBg] = useState(() => colorAttr || LAUNCHER_STYLES[normalizeWidgetStyle(styleAttr)]?.bg || "#f97316");
  const [launcherRadius, setLauncherRadius] = useState(() => LAUNCHER_STYLES[normalizeWidgetStyle(styleAttr)]?.radius || "50%");
  const [launcherShadow, setLauncherShadow] = useState(() => LAUNCHER_STYLES[normalizeWidgetStyle(styleAttr)]?.shadow || "0 6px 24px rgba(0,0,0,.25)");
  const [launcherIconOverride, setLauncherIconOverride] = useState<string | null>(null);
  const [avatarIconType, setAvatarIconType] = useState("logo");
  const [customIconUrl, setCustomIconUrl] = useState<string | null>(null);
  const [customLogoBgColor, setCustomLogoBgColor] = useState("");

  // Launcher stays invisible (but already mounted, so no layout jump once it
  // fades in) until the theme fetch below settles, one way or another — the
  // button's own initial state defaults to LAUNCHER_STYLES.minimal / the
  // "#f97316" fallback, and rendering that opaque immediately produced a
  // visible flash of the wrong color/icon that then swapped to the bot's
  // real theme moments later. The timeout is a floor, not the trigger: it
  // only reveals early if the fetch is slow/down, so a real visitor is never
  // stuck staring at nothing because of a network hiccup.
  const [revealed, setRevealed] = useState(false);
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [teaserText, setTeaserText] = useState("👋 Need help? Chat with us.");
  const triggerRulesRef = useRef<TriggerRule[]>([]);
  const triggeredRef = useRef<Record<string, boolean>>({});

  const [notificationGranted, setNotificationGranted] = useState(() =>
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted"
  );

  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 480);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const playChime = () => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        o.connect(g);
        g.connect(ctx.destination);
        const t = now + i * 0.12;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.start(t);
        o.stop(t + 0.2);
      });
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    const revealTimer = setTimeout(() => setRevealed(true), 2500);
    fetch(`${BACKEND_URL}/api/widget/theme?bot_id=${encodeURIComponent(botId)}&t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;

        if (d.widget_style) {
          const [styleName, logoBg] = String(d.widget_style).split(":");
          const norm = normalizeWidgetStyle(styleName);
          setCurrentDesign(norm);
          const preset = LAUNCHER_STYLES[norm];
          if (preset && !colorAttr) {
            setLauncherBg(preset.bg);
            setLauncherRadius(preset.radius);
            setLauncherShadow(preset.shadow);
          }
          if (logoBg) setCustomLogoBgColor(logoBg);
        } else if (d.primary_color && !colorAttr) {
          setLauncherBg(d.primary_color);
        }

        if (d.color_scheme?.launcher && !colorAttr) {
          const lc = d.color_scheme.launcher;
          if (lc.bg) setLauncherBg(lc.bg);
          if (lc.text) setLauncherIconOverride(lc.text);
        }

        if (d.avatar_icon) setAvatarIconType(d.avatar_icon);
        const logo = (d.avatar_icon === "custom" && d.avatar_url) ? d.avatar_url : d.logo_url;
        if (logo) setCustomIconUrl(logo);

        if (d.panel_size && PANEL_SIZE_PRESETS[d.panel_size]) setPanelSize(d.panel_size);

        if (d.teaser_message || d.welcome_message) {
          setTeaserText(d.teaser_message || d.welcome_message);
        }

        if (d.trigger_rules) {
          try {
            const rules = typeof d.trigger_rules === "string" ? JSON.parse(d.trigger_rules) : d.trigger_rules;
            if (Array.isArray(rules)) triggerRulesRef.current = rules;
          } catch {}
        }

        // Initialize teaser rules
        if (teaserEnabled) {
          setTimeout(() => {
            if (!open) setTeaserVisible(true);
          }, 6000);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRevealed(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(revealTimer);
    };
  }, [botId, colorAttr, styleAttr, teaserEnabled, open]);

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      setUnread(0);
      setTeaserVisible(false);
      onOpen?.();
    } else {
      onClose?.();
    }
  };

  // Expose imperative open/close/toggle once, matching widget.js's
  // documented `window.Chatty.open()/.close()/.toggle()` API — these
  // close over the latest `open` value via the ref below rather than
  // re-firing onApiReady on every open/close toggle.
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (!onApiReady) return;
    onApiReady({
      open: () => handleOpen(true),
      close: () => handleOpen(false),
      toggle: () => handleOpen(!openRef.current),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onApiReady]);

  const iconColor = launcherIconOverride || getOnColor(launcherBg);
  const side = position === "left" ? "left" : "right";
  const panelRadius = (colorAttr ? null : PANEL_RADIUS[currentDesign]) || "16px";

  const activePreset = PANEL_SIZE_PRESETS[panelSize] || PANEL_SIZE_PRESETS.default;
  const panelWidth = customSize?.width ?? activePreset.width;
  const panelHeight = customSize?.height ?? activePreset.height;

  // The panel is anchored by `bottom` + `[side]` (never top/left directly),
  // so growing width/height alone already extends it away from whichever
  // corner is pinned — no need to also reposition the panel while dragging.
  // Only the sign of each delta flips with `side`, since dragging toward the
  // panel's open interior always means "grow" regardless of which edge that
  // is on screen.
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    resizeDragRef.current = { startX: e.clientX, startY: e.clientY, startW: panelWidth, startH: panelHeight };
    const widthSign = side === "right" ? -1 : 1;
    const onMove = (ev: PointerEvent) => {
      const drag = resizeDragRef.current;
      if (!drag) return;
      const nextWidth = drag.startW + (ev.clientX - drag.startX) * widthSign;
      const nextHeight = drag.startH - (ev.clientY - drag.startY);
      setCustomSize({
        width: Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, nextWidth)),
        height: Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, nextHeight)),
      });
    };
    const onUp = () => {
      resizeDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const renderIcon = () => {
    if (open) {
      return <X style={{ width: 28, height: 28, stroke: iconColor }} />;
    }
    if (avatarIconType && LAUNCHER_ICONS[avatarIconType]) {
      const Icon = LAUNCHER_ICONS[avatarIconType];
      return <Icon style={{ width: 28, height: 28, stroke: iconColor }} />;
    }
    if (customIconUrl) {
      return (
        <img
          src={customIconUrl}
          alt=""
          style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", backgroundColor: customLogoBgColor || "transparent" }}
        />
      );
    }
    return <MessageCircle style={{ width: 28, height: 28, stroke: iconColor }} />;
  };

  return (
    <div className="chatty-standalone-root font-sans antialiased text-foreground text-sm" style={{ colorScheme: "normal" }}>
      {/* Teaser Bubble */}
      {teaserVisible && !open && teaserEnabled && (
        <div
          onClick={() => handleOpen(true)}
          style={{
            position: "fixed",
            bottom: "92px",
            [side]: "20px",
            maxWidth: "280px",
            background: "#ffffff",
            color: "#111827",
            borderRadius: "14px",
            padding: "12px 32px 12px 14px",
            boxShadow: "0 8px 30px rgba(0,0,0,.18)",
            cursor: "pointer",
            zIndex: 2147483646,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "14px",
            lineHeight: 1.45,
            transition: "all 0.25s ease",
            // The shadow host is pointer-events:none (so the widget doesn't
            // block clicks elsewhere on the host page); only elements that
            // opt back in with pointer-events:auto are actually clickable.
            // This bubble never did, so both it and its dismiss button were
            // visually present but inert to real clicks.
            pointerEvents: "auto",
          }}
        >
          {/* A real <button>, not a bare <span>, and sized as an actual
              28x28 tap target rather than tight to the "×" glyph (which was
              only ~12x18px — below any usable touch-target size, easy to
              miss on a real click/tap even though the handler itself was
              always correct). */}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setTeaserVisible(false);
            }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              lineHeight: 1,
              color: "#9ca3af",
              cursor: "pointer",
              background: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            &times;
          </button>
          <span>{teaserText}</span>
        </div>
      )}

      {/* Chat Panel (Native Vector DOM - Zero Iframe Blur!) */}
      <div
        className="chatty-panel-container"
        style={{
          position: "fixed",
          zIndex: 2147483646,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 12px 48px rgba(0,0,0,.28)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
          opacity: open ? 1 : 0,
          transform: open ? "none" : "translateY(12px)",
          pointerEvents: open ? "auto" : "none",
          ...(isMobile && mobileFullscreen
            ? {
                bottom: "0px",
                [side]: "0px",
                width: "100vw",
                height: "100dvh",
                maxWidth: "100vw",
                maxHeight: "100dvh",
                borderRadius: "0px",
              }
            : {
                bottom: "92px",
                [side]: "20px",
                width: `${panelWidth}px`,
                height: `${panelHeight}px`,
                maxWidth: "calc(100vw - 40px)",
                maxHeight: "calc(100vh - 120px)",
                borderRadius: panelRadius,
              }),
        }}
      >
        {/* Resize handle — sits at the corner opposite the panel's anchored
            corner (bottom+[side]), so dragging it always grows the panel
            away from wherever it's pinned. Skipped on mobile fullscreen,
            where the panel already fills the viewport. */}
        {!(isMobile && mobileFullscreen) && (
          <div
            onPointerDown={handleResizePointerDown}
            title="Drag to resize"
            style={{
              position: "absolute",
              top: 0,
              [side]: 0,
              width: "18px",
              height: "18px",
              cursor: side === "right" ? "nesw-resize" : "nwse-resize",
              zIndex: 1,
              touchAction: "none",
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              style={{
                position: "absolute",
                top: "4px",
                [side]: "4px",
                opacity: 0.35,
                transform: side === "left" ? "scaleX(-1)" : undefined,
              }}
            >
              <path d="M9 1L1 9M9 5L5 9" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
        )}
        <ChatWidgetCore
          botId={botId}
          originToken={null}
          forceFullscreen={isMobile && mobileFullscreen}
          notificationGranted={notificationGranted}
          onWidgetReady={() => setReady(true)}
          onWidgetClose={() => handleOpen(false)}
          onAssistantMessage={() => {
            if (!open) {
              setUnread((u) => u + 1);
              playChime();
            }
          }}
          onRequestNotificationPermission={() => {
            if (typeof window === "undefined" || !("Notification" in window)) return;
            Notification.requestPermission().then((permission) => {
              setNotificationGranted(permission === "granted");
            });
          }}
          onTriggerNotification={(botName, bodyText, avatarUrl) => {
            if (
              typeof window === "undefined" ||
              !("Notification" in window) ||
              Notification.permission !== "granted" ||
              document.visibilityState === "visible"
            )
              return;
            try {
              const notification = new Notification(botName, {
                body: bodyText,
                icon: avatarUrl || undefined,
              });
              notification.onclick = () => {
                window.focus();
                handleOpen(true);
              };
            } catch {}
          }}
        />
      </div>

      {/* Floating Launcher Button */}
      {(!open || !(isMobile && mobileFullscreen)) && (
        <button
          type="button"
          onClick={() => handleOpen(!open)}
          aria-label={open ? "Close chat" : "Open chat"}
          style={{
            position: "fixed",
            bottom: "20px",
            [side]: "20px",
            width: "60px",
            height: "60px",
            border: "none",
            borderRadius: launcherRadius,
            background: launcherBg,
            boxShadow: launcherShadow,
            color: iconColor,
            cursor: "pointer",
            zIndex: 2147483647,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            transition: "transform 0.2s ease, opacity 0.25s ease",
            touchAction: "manipulation",
            opacity: revealed ? 1 : 0,
            pointerEvents: revealed ? "auto" : "none",
          }}
        >
          {renderIcon()}
          {!open && unread > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                minWidth: "20px",
                height: "20px",
                borderRadius: "10px",
                background: "#ef4444",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 6px",
                boxShadow: "0 1px 4px rgba(0,0,0,.3)",
              }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

const mountedRoots = new Map<HTMLElement | ShadowRoot, Root>();

export function mountChatty(
  target: HTMLElement | ShadowRoot,
  options: StandaloneMountOptions
) {
  let root = mountedRoots.get(target);
  if (!root) {
    root = createRoot(target as HTMLElement);
    mountedRoots.set(target, root);
  }
  root.render(<ChattyStandaloneApp {...options} />);
  return {
    unmount: () => {
      root?.unmount();
      mountedRoots.delete(target);
    },
  };
}

// Just the chat panel (header, messages, composer) with no launcher button
// or teaser bubble of its own — for a host page that already has its own
// launcher chrome and only wants the panel itself. Same component and same
// zero-iframe rendering as mountChatty above, just without
// ChattyStandaloneApp's own launcher/teaser wrapped around it. Props mirror
// ChatWidgetCoreProps (see ChatWidgetCore.tsx) rather than
// StandaloneMountOptions.
export function mountChattyPanel(
  target: HTMLElement | ShadowRoot,
  options: ChatWidgetCoreProps
) {
  let root = mountedRoots.get(target);
  if (!root) {
    root = createRoot(target as HTMLElement);
    mountedRoots.set(target, root);
  }
  root.render(
    <div style={{ width: "100%", height: "100%" }}>
      <ChatWidgetCore {...options} />
    </div>
  );
  return {
    unmount: () => {
      root?.unmount();
      mountedRoots.delete(target);
    },
  };
}

// Attach to window for direct browser usage
if (typeof window !== "undefined") {
  (window as unknown as {
    ChattyDOM: { mount: typeof mountChatty; mountPanel: typeof mountChattyPanel };
  }).ChattyDOM = {
    mount: mountChatty,
    mountPanel: mountChattyPanel,
  };
}
