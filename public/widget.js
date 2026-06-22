/* Chatty embeddable support widget loader.
 * Usage:
 *   <script src="https://chatty.personaliai.com/widget.js"
 *           data-id="YOUR_BOT_UUID" data-color="#f97316" data-style="minimalist" defer></script>
 * Injects a floating button that opens the assistant in an iframe.
 */
(function () {
  "use strict";
  if (window.__chattyWidgetLoaded) return;
  window.__chattyWidgetLoaded = true;

  var script = document.currentScript;
  // Fallback: find our own <script> tag if currentScript is unavailable
  if (!script) {
    var all = document.getElementsByTagName("script");
    for (var i = 0; i < all.length; i++) {
      if ((all[i].src || "").indexOf("widget.js") !== -1) { script = all[i]; break; }
    }
  }
  var botId = script && script.getAttribute("data-id");
  if (!botId) { console.error("[Chatty] Missing data-id on widget script tag."); return; }

  // data-color / data-style are OPTIONAL overrides. When omitted, the embed
  // uses the bot's saved customization (color, style) from the dashboard.
  var colorAttr = script.getAttribute("data-color");
  var styleAttr = script.getAttribute("data-style");
  var color = colorAttr || "#f97316"; // launcher button visuals only
  var position = (script.getAttribute("data-position") || "right"); // right | left
  // Mobile full-screen is the default; developers can disable with
  // data-mobile-fullscreen="false" to keep the floating panel on phones.
  var mobileFull = (script.getAttribute("data-mobile-fullscreen") || "true") !== "false";
  var origin = new URL(script.src, location.href).origin;

  // Speed up the first open: warm up the connection to the widget origin.
  try {
    var pc = document.createElement("link");
    pc.rel = "preconnect"; pc.href = origin; pc.crossOrigin = "anonymous";
    document.head.appendChild(pc);
  } catch (e) {}
  // location.hostname is the host site embedding the widget — used for the
  // backend domain allowlist check.
  var embedParams = "host=" + encodeURIComponent(location.hostname);
  if (colorAttr) embedParams += "&color=" + encodeURIComponent(colorAttr);
  if (styleAttr) embedParams += "&style=" + encodeURIComponent(styleAttr);
  var embedUrl = origin + "/embed/" + encodeURIComponent(botId) + "?" + embedParams;

  var side = position === "left" ? "left" : "right";
  var open = false;

  // ---- Launcher button ----
  var btn = document.createElement("button");
  btn.setAttribute("aria-label", "Open chat");
  btn.style.cssText =
    "position:fixed;bottom:20px;" + side + ":20px;width:60px;height:60px;border:none;" +
    "border-radius:50%;background:" + color + ";cursor:pointer;z-index:2147483646;" +
    "box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;" +
    "transition:transform .2s ease;padding:0;";
  btn.onmouseenter = function () { btn.style.transform = "scale(1.06)"; };
  btn.onmouseleave = function () { btn.style.transform = "scale(1)"; };
  function buildChatIcon(c) {
    return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" fill="#fff"/>' +
      '<circle cx="8.5" cy="11" r="1.3" fill="' + c + '"/><circle cx="12" cy="11" r="1.3" fill="' + c + '"/>' +
      '<circle cx="15.5" cy="11" r="1.3" fill="' + c + '"/></svg>';
  }
  var chatIcon = buildChatIcon(color);
  var closeIcon =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
  btn.innerHTML = chatIcon;

  // Auto-match the launcher to the bot's saved dashboard color, unless the
  // developer pinned one with data-color.
  function applyTheme(c) {
    if (!c || colorAttr) return;
    color = c;
    btn.style.background = c;
    chatIcon = buildChatIcon(c);
    if (!open) btn.innerHTML = chatIcon;
  }
  if (!colorAttr) {
    try {
      fetch("https://personaliai-api-376030619262.us-central1.run.app/api/widget/theme?bot_id=" + encodeURIComponent(botId))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.primary_color) applyTheme(d.primary_color); })
        .catch(function () {});
    } catch (e) {}
  }

  // ---- Chat panel (iframe container) ----
  var panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;bottom:92px;" + side + ":20px;width:380px;height:560px;max-width:calc(100vw - 40px);" +
    "max-height:calc(100vh - 120px);background:#fff;border-radius:16px;overflow:hidden;z-index:2147483646;" +
    "box-shadow:0 12px 48px rgba(0,0,0,.28);opacity:0;transform:translateY(12px) scale(.98);" +
    "pointer-events:none;transition:opacity .2s ease,transform .2s ease;";

  var iframe = document.createElement("iframe");
  iframe.style.cssText = "width:100%;height:100%;border:0;display:block;";
  iframe.setAttribute("title", "Chat assistant");
  iframe.setAttribute("allow", "clipboard-write");
  // Lazy-load the iframe only when first opened
  var iframeLoaded = false;
  panel.appendChild(iframe);

  function applyMobile() {
    if (mobileFull && window.innerWidth <= 480) {
      panel.style.width = "100vw";
      panel.style.height = "100vh";
      panel.style.maxWidth = "100vw";
      panel.style.maxHeight = "100vh";
      panel.style.bottom = "0";
      panel.style[side] = "0";
      panel.style.borderRadius = "0";
    } else {
      // Floating panel (desktop, or mobile when full-screen is disabled).
      panel.style.width = "380px";
      panel.style.height = "560px";
      panel.style.maxWidth = "calc(100vw - 40px)";
      panel.style.maxHeight = "calc(100vh - 120px)";
      panel.style.bottom = "92px";
      panel.style[side] = "20px";
      panel.style.borderRadius = "16px";
    }
  }

  function setOpen(v) {
    open = v;
    if (open && !iframeLoaded) { iframe.src = embedUrl; iframeLoaded = true; }
    applyMobile();
    panel.style.opacity = open ? "1" : "0";
    panel.style.transform = open ? "translateY(0) scale(1)" : "translateY(12px) scale(.98)";
    panel.style.pointerEvents = open ? "auto" : "none";
    btn.innerHTML = open ? closeIcon : chatIcon;
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  }

  btn.addEventListener("click", function () { setOpen(!open); });
  window.addEventListener("resize", function () { if (open) applyMobile(); });

  function mount() {
    document.body.appendChild(panel);
    document.body.appendChild(btn);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
