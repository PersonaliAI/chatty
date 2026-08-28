# @personaliai/react-widget

Embed the Chatty chat assistant directly inside a React app — calls the
Chatty API directly, no iframe involved. Same UI and behavior as the
hosted `/embed/[botId]` widget.

## Why this exists

For teams building their own React / Next.js app, `@personaliai/react-widget`
lets the chat UI run directly inside your app's own DOM component tree.

- **100% Vector Sharpness**: Zero bitmap scaling or blur on trackpad pinch-zoom or high-DPI retina displays (same rendering model as Crisp).
- **Direct State Integration**: Access callbacks for notifications, unread messages, and custom launcher controls.
- **Zero Iframe Overhead**: Instant mounting with no cross-origin iframe boundaries.

For non-React websites (WordPress, Shopify, Webflow, HTML, etc.), Chatty also provides the universal `<script>` tag:

```html
<script src="https://chatty.personaliai.com/widget.js" data-id="YOUR_BOT_UUID" defer></script>
```
The script embed mounts directly into an isolated **Shadow DOM** container (`attachShadow({ mode: 'open' })`), guaranteeing CSS isolation from host styles while preserving full native vector DOM rendering.

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
// Only needed if you use bot replies with math notation
import "katex/dist/katex.min.css";

function App() {
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, width: 380, height: 560 }}>
      <ChattyWidget botId="YOUR_BOT_UUID" />
    </div>
  );
}
```

Omit `originToken` entirely (as above) to get the verified rate-limit tier
automatically — see "Origin verification" below. Pass `originToken={null}`
explicitly only if you deliberately want the unverified tier (e.g. a preview
sandbox).

`ChattyWidget` renders the full panel (header, messages, composer) filling
its container. Wire your own launcher button around it (show/hide the container, track unread via
the `onAssistantMessage` prop) the way you need.

## Props

See `ChattyWidgetProps` (exported from this package) for the full list —
it mirrors the bot's dashboard settings 1:1: `botId` (required),
`originToken`, `paramColor`, `paramStyle`, `paramName`, `paramWelcome`,
`paramAvatarIcon`, `paramAvatarUrl`, `paramLogoUrl`, `paramLogoBgColor`,
`paramShowSenderTag`, `paramCsatEnabled`, `paramColorScheme`, plus the
optional bridge props (`onWidgetReady`, `onWidgetClose`,
`onAssistantMessage`, `onRequestNotificationPermission`,
`onTriggerNotification`, `forceFullscreen`, `notificationGranted`,
`onThemeLoaded`) for wiring your own launcher chrome around it.

Only `botId` is required — everything else defaults to the bot's own
saved dashboard settings, fetched live from the Chatty API on mount.

## Origin verification

`originToken` is optional. Omit it (recommended) and this component
verifies its own origin on mount by exchanging `window.location.href` with
the backend's `/api/widget/verify-origin` endpoint. This gets you the verified rate-limit tier automatically as long as the bot's `allowed_domains` includes your site.

Pass `originToken={null}` explicitly to force the unverified tier (e.g. a
preview/playground sandbox that shouldn't count against a real domain's
quota).

## Standalone Browser Bundle

For standalone script embeds, this package also compiles `chatty-app.js` and `chatty-app.css`, which expose `window.ChattyDOM.mount(container, options)` for mounting into any DOM node or ShadowRoot.
