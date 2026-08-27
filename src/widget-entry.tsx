import { createRoot, type Root } from "react-dom/client";
import ChatWidgetCore from "./app/embed/[botId]/ChatWidgetCore";
import "./widget-styles.css";

// Standalone entry point for the public widget bundle (public/widget-app.js,
// built via `npm run build:widget` / vite.widget.config.ts). Mounted by
// widget.js into a Shadow DOM root on the host page — see the plan at
// C:\Users\HP\.claude\plans\gleaming-watching-sunrise.md for the full
// architecture. This file has no Next.js dependency: ChatWidgetCore takes
// all its config as plain props instead of reading useSearchParams().

export interface ChattyMountProps {
  botId: string;
  originToken: string | null;
  color?: string | null;
  style?: string | null;
  name?: string | null;
  welcome?: string | null;
  avatarIcon?: string | null;
  avatarUrl?: string | null;
  logoUrl?: string | null;
  logoBgColor?: string | null;
  showSenderTag?: string | null;
  csatEnabled?: string | null;
  colorScheme?: string | null;
  // Same-realm replacements for what used to be postMessage traffic between
  // widget.js and the (formerly cross-origin iframe'd) panel — see
  // ChatWidgetCore's own prop comments for the full rationale.
  isFullscreen?: boolean;
  notificationGranted?: boolean;
  onReady?: () => void;
  onClose?: () => void;
  onAssistantMessage?: () => void;
  onRequestNotificationPermission?: (botName: string, avatarUrl?: string | null) => void;
  onTriggerNotification?: (botName: string, bodyText: string, avatarUrl?: string | null) => void;
}

const roots = new WeakMap<Element | DocumentFragment, Root>();

function render(root: Root, props: ChattyMountProps) {
  root.render(
    <ChatWidgetCore
      botId={props.botId}
      originToken={props.originToken}
      isPreview={false}
      paramColor={props.color ?? null}
      paramStyle={props.style ?? null}
      paramName={props.name ?? null}
      paramWelcome={props.welcome ?? null}
      paramAvatarIcon={props.avatarIcon ?? null}
      paramAvatarUrl={props.avatarUrl ?? null}
      paramLogoUrl={props.logoUrl ?? null}
      paramLogoBgColor={props.logoBgColor ?? null}
      paramShowSenderTag={props.showSenderTag ?? null}
      paramCsatEnabled={props.csatEnabled ?? null}
      paramColorScheme={props.colorScheme ?? null}
      forceFullscreen={props.isFullscreen}
      notificationGranted={props.notificationGranted}
      onWidgetReady={props.onReady}
      onWidgetClose={props.onClose}
      onAssistantMessage={props.onAssistantMessage}
      onRequestNotificationPermission={props.onRequestNotificationPermission}
      onTriggerNotification={props.onTriggerNotification}
    />
  );
}

function update(container: Element | ShadowRoot, props: ChattyMountProps) {
  const existing = roots.get(container);
  if (existing) {
    render(existing, props);
    return;
  }
  const root = createRoot(container as Element);
  roots.set(container, root);
  render(root, props);
}

function unmount(container: Element | ShadowRoot) {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

declare global {
  interface Window {
    __chattyMountWidget: typeof update;
    __chattyUnmountWidget: typeof unmount;
  }
}

window.__chattyMountWidget = update;
window.__chattyUnmountWidget = unmount;
