<div align="center">

<img src="public/chatty-icon.png" alt="Chatty" width="88" /> <img src="public/readme-icon.png" alt="Chatty" width="88" />

# Chatty Frontend

**Next.js 16 frontend for Chatty - Dashboard, embeddable chat widget, and widget.js loader.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

[Chatty Cloud](https://chatty.personaliai.com) · [Documentation](https://docs.chatty.personaliai.com)

</div>

---

## What's Here

```
src/app/            Next.js App Router (Dashboard, Auth, Embeds, Landing)
src/components/     UI components (Tailwind CSS, Base UI, Lucide icons)
packages/           
└── chatty-react/   Standalone Shadow DOM bundle builder (chatty-app.js, chatty-app.css)
public/             Static assets, icons, and widget loader scripts (widget.js)
```

## How to Embed the Chatty Widget

Add a single `<script>` tag before `</body>` on any website:

```html
<script src="https://chatty.personaliai.com/widget.js"
        data-id="YOUR_BOT_UUID" defer></script>
```

The script mounts directly into an isolated **Shadow DOM** container, rendering native vector DOM elements - zero iframes, 100% sharp text at all zoom levels.

### Next.js / React

```tsx
import Script from "next/script";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script
        src="https://chatty.personaliai.com/widget.js"
        data-id="YOUR_BOT_UUID"
        strategy="afterInteractive"
      />
    </>
  );
}
```

## Embed the standalone voice agent

Chatty also provides a dedicated voice-call surface for websites that want a
“Talk to voice agent” experience instead of opening the chat drawer. It has an
animated speaking orb, real microphone activity, live visitor/agent
transcription, mute and hang-up controls, and booking support.

```html
<iframe
  src="https://chatty.personaliai.com/voice/YOUR_BOT_UUID"
  title="Talk to our voice agent"
  width="100%"
  height="760"
  style="border:0;border-radius:24px;overflow:hidden"
  allow="microphone"
></iframe>
```

Add the parent site to the bot allow list before publishing. Keep
`allow="microphone"` on the iframe; the visitor will be asked for permission
when the call starts. You can also link a custom button directly to
`/voice/YOUR_BOT_UUID` or open that URL in a modal.

## Local Development

```bash
# Install dependencies
npm install

# Start Next.js development server
npm run dev
```

Dashboard will be available at `http://localhost:3000`.

## Ecommerce-ready widget

The widget shares Chatty's multimodal commerce pipeline: shoppers can send a
product photo or describe an item, and the assistant can return grounded
catalog matches with price, stock, variants, product images, and checkout
links. WooCommerce synchronization and Meta WhatsApp delivery are implemented
in the backend; see [`DOCUMENTATION.md`](DOCUMENTATION.md) and the backend
[`commerce guide`](../chatty-backend/docs/COMMERCE.md) for the production
setup.

## Building the Standalone Widget Bundle

```bash
cd packages/chatty-react
npm install
npm run build
```

This compiles `chatty-app.js` and `chatty-app.css` directly into `../../public/`.

## License

MIT - see [LICENSE](LICENSE).
