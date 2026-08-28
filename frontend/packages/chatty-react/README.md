# Chatty Widget — Standalone Bundle

This package builds the **standalone Shadow DOM bundle** that powers the
Chatty embeddable chat widget (`widget.js`, `chatty-app.js`, `chatty-app.css`).

## How to Embed (All Platforms)

Add a single `<script>` tag before `</body>` on any page:

```html
<script src="https://chatty.personaliai.com/widget.js"
        data-id="YOUR_BOT_UUID" defer></script>
```

The script mounts directly into an isolated **Shadow DOM** container
(`attachShadow({ mode: 'open' })`), rendering native vector DOM elements
— zero iframes, 100% sharp text at all zoom levels (same model as Crisp).

### Next.js / React

Use the built-in `<Script>` component in your root layout:

```tsx
import Script from "next/script";

export default function Layout({ children }) {
  return (
    <>
      {children}
      <Script
        src="https://chatty.personaliai.com/widget.js"
        data-id="YOUR_BOT_ID"
        strategy="afterInteractive"
      />
    </>
  );
}
```

### WordPress

Add to `functions.php`:

```php
function chatty_widget() { ?>
<script src="https://chatty.personaliai.com/widget.js"
        data-id="YOUR_BOT_UUID" defer></script>
<?php }
add_action('wp_footer', 'chatty_widget');
```

### Shopify

Open `layout/theme.liquid` and paste the script tag before `</body>`.

## JS API

```js
window.Chatty.open();   // Open the chat panel
window.Chatty.close();  // Close the chat panel
window.Chatty.toggle(); // Toggle open/close
```

## Data Attributes

| Attribute                  | Default   | Description                        |
| -------------------------- | --------- | ---------------------------------- |
| `data-id`                  | (required)| Your bot UUID                      |
| `data-color`               | —         | Override primary color             |
| `data-style`               | —         | Widget design preset name          |
| `data-position`            | `right`   | `right` or `left`                  |
| `data-mobile-fullscreen`   | `true`    | Fullscreen on mobile               |
| `data-teaser`              | `true`    | Show teaser bubble                 |
| `data-sound`               | `true`    | Play notification chime            |

## Standalone Browser Bundle

This package compiles `chatty-app.js` and `chatty-app.css`, which expose
`window.ChattyDOM.mount(container, options)` for mounting into any DOM
node or ShadowRoot. The `widget.js` loader script handles this automatically.
