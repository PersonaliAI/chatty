# @personaliai/react-widget

The official React SDK for [Chatty](https://chatty.personaliai.com) AI chatbots and real-time voice agents.

Loads the Chatty chat assistant and LiveKit Voice Agent into your React and Next.js applications using either the lightweight **script method** inside an isolated Shadow DOM container or the native **`<VoiceAgent />`** WebRTC component. Zero CSS conflicts, 100% sharp typography, and under 2 kB bundle footprint.

---

## Installation

```bash
npm install @personaliai/react-widget
# or
yarn add @personaliai/react-widget
# or
pnpm add @personaliai/react-widget
```

If using the standalone native `<VoiceAgent />` component, also install the official LiveKit peer dependencies:

```bash
npm install @livekit/components-react @livekit/components-styles livekit-client
```

---

## Quickstart

### 1. Chat Widget (Text AI)

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

### 2. Voice Agent Widget (One-Click Voice Mode)

Set `mode="voice"` to transform the launcher into a direct Voice Agent trigger that launches a voice modal or side drawer:

```tsx
<ChattyWidget
  botId="YOUR_BOT_UUID"
  mode="voice"
  display="modal" // or "drawer"
/>
```

---

## Programmatic Control with `useChatty()`

Control the chat drawer or voice agent modal from custom buttons, hero banners, or navbar links:

```tsx title="components/HelpButtons.tsx"
"use client";

import { useChatty } from "@personaliai/react-widget";

export function HelpButtons() {
  const { open, close, toggle, openVoice } = useChatty();

  return (
    <div className="flex gap-3">
      {/* Opens the standard chat assistant */}
      <button onClick={open} className="btn-chat">
        💬 Chat with AI
      </button>

      {/* Launches the real-time LiveKit voice agent session */}
      <button onClick={() => openVoice("modal")} className="btn-voice">
        🎙️ Talk to Voice Agent
      </button>
    </div>
  );
}
```

---

## `<ChattyWidget />` Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `botId` | `string` | **Required** | Your bot's unique UUID from the Chatty dashboard. |
| `mode` | `"chat" \| "voice"` | `"chat"` | Launch mode: `"chat"` opens text assistant; `"voice"` opens the LiveKit voice agent. |
| `display` | `"modal" \| "drawer"` | `"modal"` | For voice mode: `"modal"` renders a centered popup dialog, `"drawer"` renders a right-hand slide-over panel. |
| `launcher` | `"default" \| "none"` | `"default"` | Set to `"none"` to hide the floating corner button and control via `useChatty()`. |
| `position` | `"right" \| "left"` | `"right"` | Corner anchor position for the launcher trigger button. |
| `color` | `string` | Dashboard color | Hex color override for the launcher trigger button. |
| `style` | `string` | Dashboard style | Visual style preset override (`"minimal"`, `"playful"`, etc.). |
| `mobileFullscreen` | `boolean` | `true` | When true, expands full-screen on mobile viewports. |
| `teaser` | `boolean` | `true` | Whether to display the greeting teaser bubble after delay. |
| `sound` | `boolean` | `true` | Whether to play sound chimes on incoming AI replies. |
| `widgetUrl` | `string` | `"https://chatty.personaliai.com/widget.js"` | Custom widget script URL (for self-hosting). |

---

## Standalone `<VoiceAgent />` Component

The SDK exports a first-class LiveKit voice surface with real-time audio visualization, live speech-to-text transcripts, assistant image attachments, echo cancellation, and interactive calendar booking. It requests a short-lived token from Chatty and never receives LiveKit or provider secrets.

```tsx
import { VoiceAgent } from "@personaliai/react-widget";
import "@personaliai/react-widget/styles.css";

export function SupportVoice() {
  return (
    <div className="max-w-md mx-auto h-[600px] rounded-2xl shadow-2xl overflow-hidden">
      <VoiceAgent
        botId="YOUR_BOT_UUID"
        title="Voice Support Agent"
        visualizer="aura" // "wave" | "bar" | "grid" | "radial" | "aura"
        showVisualizer={true}
        showTranscription={true}
        onStateChange={(state) => console.log("Voice state:", state)}
      />
    </div>
  );
}
```

### `<VoiceAgent />` Features & Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `botId` | `string` | **Required** | The bot UUID configured in Chatty Voice Studio. |
| `title` | `string` | `"Voice Agent"` | Header title rendered at the top of the voice panel. |
| `visualizer` | `"wave" \| "bar" \| "grid" \| "radial" \| "aura"` | `"wave"` | Real-time audio waveform visualizer animation. |
| `showVisualizer` | `boolean` | `true` | Displays or hides the central reactive audio visualizer. |
| `showTranscription`| `boolean` | `true` | Displays live bidirectional transcription cards with smooth autoscroll. |
| `showBooking` | `boolean` | `true` | Allows calendar slot selection and lead capture directly in the session. |
| `backendUrl` | `string` | Cloud URL | Base API URL (set to `http://localhost:8000` or custom domain for self-hosted instances). |
| `widgetToken` | `string` | `undefined` | Signed contact identity token for authenticated enterprise users. |
| `onStateChange` | `(state: AgentState) => void` | `undefined` | Callback for state transitions (`"idle"`, `"connecting"`, `"listening"`, `"thinking"`, `"speaking"`). |
| `onTranscript` | `(item: TranscriptItem) => void` | `undefined` | Callback stream for user and assistant spoken utterances. |

### Memory Reset & Session Isolation

The voice agent includes a built-in session reset trigger:
- Clicking the **Reset** action or invoking `resetSession()` clears stored conversation memory on the server (`POST /api/widget/voice/reset`) and mints a fresh LiveKit room nonce.
- Ensures previous session context is completely purged when starting a new customer conversation.

---

## License

MIT
