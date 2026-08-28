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
`onTriggerNotification`, `forceFullscreen`, `notificationGranted`,
`onThemeLoaded`) for wiring your own launcher chrome around it.

Only `botId` is required — everything else defaults to the bot's own
saved dashboard settings, fetched live from the Chatty API on mount.

## Origin verification

`originToken` is optional. Omit it (recommended) and this component
verifies its own origin on mount by exchanging `window.location.href` with
the backend's `/api/widget/verify-origin` endpoint — the same mechanism
`EmbedClient.tsx`'s iframe route uses, just driven by the page's own URL
instead of a server-captured Referer, since a same-realm mount has no
iframe navigation for a parent page to capture one on its behalf. This
gets you the verified rate-limit tier automatically as long as the bot's
`allowed_domains` includes your site.

Pass `originToken={null}` explicitly to force the unverified tier (e.g. a
preview/playground sandbox that shouldn't count against a real domain's
quota), or pass an already-minted token string if your app calls
`/api/widget/verify-origin` itself for some other reason.

## Avoiding duplicate theme fetches

If your host app renders its own chrome around this widget (a custom
launcher button, a header showing the bot's name/avatar), don't fetch
`/api/widget/theme` yourself — pass `onThemeLoaded` and reuse the same
data this component already fetches on mount and on its periodic refresh:

```tsx
<ChattyWidget
  botId={botId}
  onThemeLoaded={(theme) => setLauncherLook(deriveLookFrom(theme))}
/>
```

`theme` is a `WidgetThemeData` (also exported from this package) with the
fields a launcher typically needs: `primary_color`, `widget_style`,
`avatar_icon`, `avatar_url`, `logo_url`, `color_scheme`, plus
`teaser_message`/`welcome_message`/`trigger_rules` for a proactive greeting
bubble.

## Launcher-button styling presets

`LAUNCHER_STYLES`, `PANEL_RADIUS`, and `normalizeWidgetStyle` (each design
preset's default launcher look, its chat-panel corner radius, and the
legacy-style-id migration map) are available from `@personaliai/react-widget/widget-style`,
and `getOnColor`/`hexToRgb`/`generateColorScheme` from
`@personaliai/react-widget/color-contrast` — import these instead of
hand-copying the values into your own launcher component, so a preset
change here doesn't silently drift out of sync with your button.

## Building this package

```bash
cd packages/chatty-react
npm install
npm run build      # emits dist/index.{js,cjs,d.ts} + dist/styles.css
```

Published to the public npm registry as `@personaliai/react-widget`.
