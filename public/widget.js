/* Chatty embeddable support widget loader.
 * Usage:
 *   <script src="https://chatty.personaliai.com/widget.js"
 *           data-id="YOUR_BOT_UUID" data-color="#f97316" data-style="minimalist" defer></script>
 * Injects a floating button that opens the assistant in an iframe.
 *
 * JS API (after load): window.Chatty.open() / .close() / .toggle()
 * Data attributes: data-color, data-style, data-position(left|right),
 *   data-mobile-fullscreen("false" to disable), data-teaser("false" to disable),
 *   data-sound("false" to disable the new-message chime).
 */
(function () {
  "use strict";
  if (window.__chattyWidgetLoaded) return;
  window.__chattyWidgetLoaded = true;

  var BACKEND = "https://personaliai-api-376030619262.us-central1.run.app";

  var script = document.currentScript;
  if (!script) {
    var all = document.getElementsByTagName("script");
    for (var i = 0; i < all.length; i++) {
      if ((all[i].src || "").indexOf("widget.js") !== -1) { script = all[i]; break; }
    }
  }
  var botId = script && script.getAttribute("data-id");
  if (!botId) { console.error("[Chatty] Missing data-id on widget script tag."); return; }

  // data-color / data-style are OPTIONAL overrides. When omitted, the embed
  // uses the bot's saved customization from the dashboard.
  var colorAttr = script.getAttribute("data-color");
  var styleAttr = script.getAttribute("data-style");
  var color = colorAttr || "#f97316"; // launcher button visuals only
  var position = (script.getAttribute("data-position") || "right"); // right | left
  var mobileFull = (script.getAttribute("data-mobile-fullscreen") || "true") !== "false";
  var teaserEnabled = (script.getAttribute("data-teaser") || "true") !== "false";
  var soundEnabled = (script.getAttribute("data-sound") || "true") !== "false";
  var origin = new URL(script.src, location.href).origin;

  try {
    var pc = document.createElement("link");
    pc.rel = "preconnect"; pc.href = origin; pc.crossOrigin = "anonymous";
    document.head.appendChild(pc);
    var spinStyle = document.createElement("style");
    spinStyle.textContent = "@keyframes chatty-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(spinStyle);
  } catch (e) {}

  var embedParams = "host=" + encodeURIComponent(location.hostname);
  if (colorAttr) embedParams += "&color=" + encodeURIComponent(colorAttr);
  if (styleAttr) embedParams += "&style=" + encodeURIComponent(styleAttr);
  var embedUrl = origin + "/embed/" + encodeURIComponent(botId) + "?" + embedParams;

  var side = position === "left" ? "left" : "right";
  var open = false;
  var ready = false; // embed iframe finished loading bot config
  var pendingOpen = false; // clicked to open, waiting for the iframe to be ready
  var unread = 0;
  var teaserText = "";
  var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif";

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Subtle two-tone notification chime (Web Audio — no asset needed). Browsers
  // only allow this after the visitor has interacted with the page.
  var audioCtx = null;
  function playPing() {
    if (!soundEnabled) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      var now = audioCtx.currentTime;
      [880, 1320].forEach(function (freq, i) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = freq;
        o.connect(g); g.connect(audioCtx.destination);
        var t = now + i * 0.12;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.start(t); o.stop(t + 0.2);
      });
    } catch (e) {}
  }

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
  var spinnerIcon =
    '<svg width="26" height="26" viewBox="0 0 24 24" style="animation:chatty-spin .7s linear infinite;transform-origin:center">' +
    '<circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>' +
    '<path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>';
  function setBtnIcon() { btn.innerHTML = (pendingOpen || (open && !ready)) ? spinnerIcon : (open ? closeIcon : chatIcon); }
  btn.innerHTML = chatIcon;

  // ---- Unread badge ----
  var badge = document.createElement("div");
  badge.style.cssText =
    "position:fixed;bottom:64px;" + side + ":14px;min-width:20px;height:20px;border-radius:10px;" +
    "background:#ef4444;color:#fff;font:bold 11px " + FONT + ";display:none;align-items:center;" +
    "justify-content:center;padding:0 6px;z-index:2147483647;box-shadow:0 1px 4px rgba(0,0,0,.3);";
  function renderBadge() {
    if (unread > 0 && !open) { badge.textContent = unread > 9 ? "9+" : String(unread); badge.style.display = "flex"; }
    else { badge.style.display = "none"; }
  }

  // ---- Proactive greeting teaser ----
  var teaser = document.createElement("div");
  teaser.style.cssText =
    "position:fixed;bottom:92px;" + side + ":20px;max-width:260px;background:#fff;color:#111827;" +
    "border-radius:14px;padding:12px 32px 12px 14px;font:14px/1.45 " + FONT + ";" +
    "box-shadow:0 8px 30px rgba(0,0,0,.18);cursor:pointer;display:none;opacity:0;" +
    "transform:translateY(8px);transition:opacity .25s ease,transform .25s ease;z-index:2147483646;";
  var teaserClose = document.createElement("div");
  teaserClose.innerHTML = "&times;";
  teaserClose.style.cssText = "position:absolute;top:6px;right:9px;font-size:18px;line-height:1;color:#9ca3af;cursor:pointer;";
  var teaserMsg = document.createElement("span");
  teaser.appendChild(teaserClose);
  teaser.appendChild(teaserMsg);
  function showTeaser() {
    if (open || !teaserEnabled) return;
    if (lsGet("chatty_teaser_" + botId) === "dismissed") return;
    teaserMsg.textContent = teaserText || "👋 Need help? Chat with us.";
    teaser.style.display = "block";
    requestAnimationFrame(function () { teaser.style.opacity = "1"; teaser.style.transform = "translateY(0)"; });
  }
  function hideTeaser() {
    teaser.style.opacity = "0"; teaser.style.transform = "translateY(8px)";
    setTimeout(function () { teaser.style.display = "none"; }, 250);
  }
  teaser.addEventListener("click", function () { hideTeaser(); setOpen(true); });
  teaserClose.addEventListener("click", function (e) { e.stopPropagation(); hideTeaser(); lsSet("chatty_teaser_" + botId, "dismissed"); });

  // ---- Theme + teaser text from dashboard ----
  function applyTheme(c) {
    if (!c || colorAttr) return;
    color = c; btn.style.background = c; chatIcon = buildChatIcon(c);
    if (!open) btn.innerHTML = chatIcon;
  }
  try {
    fetch(BACKEND + "/api/widget/theme?bot_id=" + encodeURIComponent(botId))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        if (d.primary_color) applyTheme(d.primary_color);
        teaserText = d.teaser_message || d.welcome_message || teaserText;
      })
      .catch(function () {});
  } catch (e) {}

  // ---- Chat panel (iframe container) ----
  var panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;bottom:92px;" + side + ":20px;width:380px;height:560px;max-width:calc(100vw - 40px);" +
    "max-height:calc(100vh - 120px);border-radius:16px;overflow:hidden;z-index:2147483646;" +
    "box-shadow:0 12px 48px rgba(0,0,0,.28);opacity:0;transform:translateY(12px) scale(.98);" +
    "pointer-events:none;transition:opacity .2s ease,transform .2s ease;";

  var iframe = document.createElement("iframe");
  iframe.style.cssText = "width:100%;height:100%;border:0;display:block;border-radius:16px;overflow:hidden;";
  iframe.setAttribute("title", "Chat assistant");
  iframe.setAttribute("allow", "clipboard-write;microphone");
  var iframeLoaded = false;
  panel.appendChild(iframe);

  function applyMobile() {
    if (mobileFull && window.innerWidth <= 480) {
      panel.style.width = "100vw"; panel.style.height = "100vh";
      panel.style.maxWidth = "100vw"; panel.style.maxHeight = "100vh";
      panel.style.bottom = "0"; panel.style[side] = "0"; panel.style.borderRadius = "0";
      iframe.style.borderRadius = "0";
    } else {
      panel.style.width = "380px"; panel.style.height = "560px";
      panel.style.maxWidth = "calc(100vw - 40px)"; panel.style.maxHeight = "calc(100vh - 120px)";
      panel.style.bottom = "92px"; panel.style[side] = "20px"; panel.style.borderRadius = "16px";
      iframe.style.borderRadius = "16px";
    }
  }

  function setOpen(v) {
    open = v;
    if (open) {
      unread = 0; hideTeaser();
      if (!iframeLoaded) { iframe.src = embedUrl; iframeLoaded = true; }
      // Fail-safe: never spin forever if the ready signal doesn't arrive.
      if (!ready) setTimeout(function () { if (!ready) { ready = true; setBtnIcon(); } }, 6000);
    }
    renderBadge();
    applyMobile();
    panel.style.opacity = open ? "1" : "0";
    panel.style.transform = open ? "translateY(0) scale(1)" : "translateY(12px) scale(.98)";
    panel.style.pointerEvents = open ? "auto" : "none";
    setBtnIcon();
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    // On mobile full-screen, hide the floating launcher while open — the
    // in-panel header close button handles closing, avoiding overlap with the
    // composer's send button.
    var hideLauncher = open && mobileFull && window.innerWidth <= 480;
    btn.style.display = hideLauncher ? "none" : "flex";
  }

  btn.addEventListener("click", function () {
    if (open) { setOpen(false); return; }
    if (pendingOpen) return;
    if (!ready) {
      // Load first, spin, and reveal the panel only once the chat is ready.
      if (!iframeLoaded) { iframe.src = embedUrl; iframeLoaded = true; }
      pendingOpen = true; hideTeaser(); setBtnIcon();
      setTimeout(function () { if (pendingOpen) { ready = true; pendingOpen = false; setOpen(true); } }, 8000);
      return;
    }
    setOpen(true);
  });
  window.addEventListener("resize", function () { if (open) { applyMobile(); setOpen(true); } });

  // ---- Messages from the embed iframe (unread badge) ----
  window.addEventListener("message", function (ev) {
    if (ev.origin !== origin) return;
    var d = ev.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "chatty:close") { setOpen(false); return; }
    if (d.type === "chatty:ready") { ready = true; if (pendingOpen) { pendingOpen = false; setOpen(true); } else setBtnIcon(); }
    if (d.type === "chatty:message" && d.role === "assistant" && !open) {
      unread++; renderBadge(); playPing();
    }
  });

  // ---- Public JS API ----
  window.Chatty = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    toggle: function () { setOpen(!open); }
  };

  function mount() {
    document.body.appendChild(panel);
    document.body.appendChild(teaser);
    document.body.appendChild(btn);
    document.body.appendChild(badge);
    setTimeout(showTeaser, 6000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
