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
    <button onClick={open} className="btn-help">
      💬 Chat with Support
    </button>
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

---

## License

MIT
