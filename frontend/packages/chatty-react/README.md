# @personaliai/react-widget

The official React SDK for [Chatty](https://chatty.personaliai.com) AI chatbots.

Loads the Chatty chat assistant into your React and Next.js applications using the lightweight **script method** inside an isolated Shadow DOM container. Zero CSS conflicts, 100% sharp typography, and under 2 kB bundle footprint.

---

## Installation

```bash
npm install @personaliai/react-widget
# or
yarn add @personaliai/react-widget
# or
pnpm add @personaliai/react-widget
```

---

## Quickstart

Add the `<ChattyWidget />` component to your root layout or main application view:

```tsx title="app/layout.tsx (Next.js App Router)"
import { ChattyWidget } from "@personaliai/react-widget";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChattyWidget
          botId="YOUR_BOT_UUID"
          position="right"
          color="#4F46E5"
        />
      </body>
    </html>
  );
}
```

---

## Programmatic Control with `useChatty()`

Control the chat drawer from custom buttons or navbar triggers:

```tsx title="components/HelpButton.tsx"
"use client";

import { useChatty } from "@personaliai/react-widget";

export function HelpButton() {
  const { open, close, toggle } = useChatty();

  return (
    <div>
      <button onClick={open} className="btn-help">
        💬 Chat with Support
      </button>
    </div>
  );
}
```

---

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `botId` | `string` | **Required** | Your bot's unique UUID from the Chatty dashboard. |
| `position` | `"right" \| "left"` | `"right"` | Corner anchor position for the launcher trigger button. |
| `color` | `string` | Dashboard color | Hex color override for the launcher trigger button. |
| `style` | `string` | Dashboard style | Visual style preset override (`"minimal"`, `"playful"`, etc.). |
| `mobileFullscreen` | `boolean` | `true` | When true, expands full-screen on mobile viewports. |
| `teaser` | `boolean` | `true` | Whether to display the greeting teaser bubble after delay. |
| `sound` | `boolean` | `true` | Whether to play sound chimes on incoming AI replies. |
| `widgetUrl` | `string` | `"https://chatty.personaliai.com/widget.js"` | Custom widget script URL (for self-hosting). |

## Standalone voice agent

The SDK also exports a first-class LiveKit voice surface. It requests a
short-lived token from Chatty and never receives LiveKit or provider secrets.
Install the LiveKit peer dependencies when using this component:

```bash
npm install @personaliai/react-widget @livekit/components-react @livekit/components-styles livekit-client
```

```tsx
import { VoiceAgent } from "@personaliai/react-widget";
import "@personaliai/react-widget/styles.css";

export function SupportVoice() {
  return <VoiceAgent botId="YOUR_BOT_UUID" title="Talk to support" />;
}
```

`VoiceAgent` includes official LiveKit session controls, realtime transcript
updates, audio visualization, consent, interruption, connection errors, and a
verified booking panel. The booking panel reuses Chatty's calendar slot API,
supports manual slot selection, collects the configured lead fields, and uses
email OTP verification when enabled. A spoken booking request automatically
opens the same panel so visitors can continue by voice or by selecting a slot.
Use `backendUrl` for a self-hosted API and `widgetToken` for signed embedded
deployments. For host-controlled sessions, attach a React ref and call
`start()`, `stop()`, or `toggleMicrophone()`; `onStateChange` and
`onTranscript` expose realtime session events without exposing provider keys.

Set `showBooking={false}` only when an integration intentionally provides its
own booking surface. Voice lead capture is confirmation-gated: the agent reads
the required details back and asks for an explicit confirmation before saving.

---

## License

MIT
