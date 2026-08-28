# @personaliai/react-widget

Embed the Chatty chat assistant directly inside a React app — calls the
Chatty API directly, no iframe involved. Same UI and behavior as the
hosted `/embed/[botId]` widget (this package's `ChattyWidget` component
*is* that same component, extracted).

## Why this exists

The default embed (`<script src="https://chatty.personaliai.com/widget.js">`)
loads the chat panel in an iframe. For a customer site on its own domain,
that's a **cross-origin** iframe, which Chrome's Site Isolation gives its
own separate rendering surface — this measurably softens text rendering
during/after browser zoom. For a React app that already has its own build
step, that iframe boundary is unnecessary: this package lets the same chat
UI run directly in the host page's own DOM instead, avoiding the cross-origin
surface entirely.

This does **not** replace `widget.js` for non-React sites (WordPress,
static HTML, Squarespace, etc.) — those still need a `<script>` tag, and
that's still iframe-based. This package is for teams building their own
React app who can `npm install` a component instead.

## Install

```bash
npm install @personaliai/react-widget
```

`react` and `react-dom` (>=18) are peer dependencies — everything else this
package needs (framer-motion, react-markdown, katex, livekit-client, etc.)
is bundled in.

## Usage

```tsx
import { ChattyWidget } from "@personaliai/react-widget";
import "@personaliai/react-widget/styles.css";
// Only needed if you use bot replies with math notation — same as the
// hosted embed, this isn't bundled in since it's ~1MB of embedded fonts.
import "katex/dist/katex.min.css";

function App() {
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, width: 380, height: 560 }}>
      <ChattyWidget botId="YOUR_BOT_UUID" originToken={null} />
    </div>
  );
}
```

`ChattyWidget` renders the full panel (header, messages, composer) filling
its container — it doesn't manage a floating launcher button, open/close
state, unread badge, or teaser message the way `widget.js` does. Wire your
own launcher button around it (show/hide the container, track unread via
the `onAssistantMessage` prop) the way this repo's own `EmbedClient.tsx`
wires it for the iframe route, or the way `widget.js` wires it for the
Shadow DOM mount in that (currently reverted) architecture.

## Props

See `ChattyWidgetProps` (exported from this package) for the full list —
it mirrors the bot's dashboard settings 1:1: `botId` (required),
`originToken`, `paramColor`, `paramStyle`, `paramName`, `paramWelcome`,
`paramAvatarIcon`, `paramAvatarUrl`, `paramLogoUrl`, `paramLogoBgColor`,
`paramShowSenderTag`, `paramCsatEnabled`, `paramColorScheme`, plus the
optional bridge props (`onWidgetReady`, `onWidgetClose`,
`onAssistantMessage`, `onRequestNotificationPermission`,
`onTriggerNotification`, `forceFullscreen`, `notificationGranted`) for
wiring your own launcher chrome around it.

Only `botId` is required — everything else defaults to the bot's own
saved dashboard settings, fetched live from the Chatty API on mount.

## Origin verification

`originToken` is optional. Passing `null` (as in the example above) means
every chat call falls into the backend's stricter *unverified-origin*
rate-limit tier — never a hard block, just a lower message-per-minute
ceiling (see `main.py`'s `_widget_rate_limit_or_429`). The hosted
`widget.js`/iframe path gets a verified token via a server-side Referer
exchange that only a real iframe navigation can produce; this package runs
directly in your own page with no equivalent mechanism, so there is
currently no way to mint one from here. If your usage needs the higher
rate-limit tier, get in touch about a proper API-key-based verification
path for direct SDK usage instead.

## Building this package

```bash
cd packages/chatty-react
npm install
npm run build      # emits dist/index.{js,cjs,d.ts} + dist/styles.css
```

Not currently published to a public npm registry — install via `file:` or
a private registry until that's set up.
