# 💬 Chatty Widget Integration Guide

Embed Chatty's vector-sharp, streaming AI assistant onto any website, web app, or storefront in under 60 seconds.

---

## ⚡ 3-Line Embed (Any Website / HTML)

Paste this snippet just before the closing `</body>` tag on any webpage:

```html
<!-- Chatty Embed Script -->
<script src="https://chatty.personaliai.com/widget.js" data-bot-id="YOUR_BOT_UUID" defer></script>
```

That's it! The widget initializes an isolated **Shadow DOM container** with zero iframe zoom distortion, matching the user's system color scheme and rendering crisp typography.

---

## ⚛️ React 18 & 19 Integration

Install the official React widget package:

```bash
npm install @personaliai/react-widget
# or
pnpm add @personaliai/react-widget
# or
yarn add @personaliai/react-widget
```

Render anywhere in your application tree:

```tsx
import { ChatWidgetCore } from '@personaliai/react-widget';

export function App() {
  return (
    <div>
      <main>Your Website Content</main>
      
      {/* Chatty AI Assistant */}
      <ChatWidgetCore
        botId="YOUR_BOT_UUID"
        theme="auto"
        accentColor="#111827"
        launcherPosition="bottom-right"
      />
    </div>
  );
}
```

---

## ▲ Next.js (App Router) Integration

In `app/layout.tsx`:

```tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* Chatty Widget */}
        <Script
          src="https://chatty.personaliai.com/widget.js"
          data-bot-id={process.env.NEXT_PUBLIC_CHATTY_BOT_ID}
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
```

---

## 🛍️ Shopify Storefront Integration

1. Go to your **Shopify Admin → Online Store → Themes**.
2. Click **... → Edit code**.
3. Open `layout/theme.liquid`.
4. Scroll to the bottom and paste right before `</body>`:

```html
<!-- Chatty Shopify Assistant -->
<script
  src="https://chatty.personaliai.com/widget.js"
  data-bot-id="YOUR_BOT_UUID"
  defer>
</script>
```
5. Click **Save**.

---

## 🌐 WordPress Integration

### Option A: Official Chatty WordPress Plugin
1. Download the plugin from [`integrations/wordpress/chatty-wordpress-plugin`](../integrations/wordpress/chatty-wordpress-plugin).
2. Upload to `wp-content/plugins/` and activate in `wp-admin`.
3. Enter your **Bot ID** in **Settings → Chatty**.

### Option B: Theme Header/Footer
1. Go to **Appearance → Theme File Editor → footer.php**.
2. Add the 3-line embed script before `wp_footer()`.

---

## 💻 Programmatic JavaScript API (`window.Chatty`)

### Pass the logged-in customer to Chatty securely

The browser must **not** send an email/name object directly. Your authenticated
application server signs a short-lived customer JWT, then the browser passes that
token after `chatty:ready`:

```javascript
window.addEventListener("chatty:ready", async () => {
  const response = await fetch("/api/my-chatty-identity", { cache: "no-store" });
  if (!response.ok) return; // anonymous visitors are valid
  const { token } = await response.json();
  await window.Chatty.identify(token);
});
```

The server endpoint reads the customer from its own validated login session and
signs `sub`, `name`, `email`, `phone`, and scalar `custom_attributes` claims with
the bot's identity secret. See the complete server/JWT example, iframe flow,
logout rules, and security limits in [`INBOX_IDENTITY_SETUP.md`](INBOX_IDENTITY_SETUP.md).

Once loaded, the widget exposes a global `window.Chatty` object for custom interactions:

```javascript
// Open or close the chat drawer
window.Chatty.open();
window.Chatty.close();
window.Chatty.toggle();

// Launch real-time WebRTC Voice call directly
window.Chatty.openVoice();

// Identify a logged-in customer with a short-lived token minted by your server.
// Never pass raw profile fields or your signing secret from browser code.
window.addEventListener("chatty:ready", async () => {
  const response = await fetch("/api/my-chatty-identity", { cache: "no-store" });
  if (response.ok) await window.Chatty.identify((await response.json()).token);
});

// Programmatically send a message as the visitor
window.Chatty.sendMessage("I need help with my invoice");

// Listen to widget lifecycle events
window.addEventListener('chatty:opened', () => {
  console.log("Chatty widget opened by visitor");
});

window.addEventListener('chatty:lead_captured', (event) => {
  console.log("Lead captured:", event.detail);
});
```
