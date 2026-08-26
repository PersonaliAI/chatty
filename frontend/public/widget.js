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

  // Exit immediately if loaded by a crawler, headless browser, or scraper
  var ua = (navigator.userAgent || "").toLowerCase();
  var isBot = /jina|bot|crawl|spider|headless|lighthouse/i.test(ua) || navigator.webdriver;
  if (isBot) return;

  window.__chattyWidgetLoaded = true;

  var BACKEND = "https://api.chatty.personaliai.com";

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
  } catch {}

  // WCAG-based "what text/icon color goes on this background" — the business
  // owner picks the launcher color freely, so a hardcoded white icon/stroke
  // goes invisible the moment they pick a light color. Mirrors
  // src/lib/color-contrast.ts's logic (kept in sync manually since this file
  // ships standalone, unbundled, to third-party sites).
  function getOnColor(hex) {
    var clean = (hex || "#f97316").replace("#", "").trim();
    var full = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean;
    var num = parseInt(full, 16);
    if (full.length !== 6 || isNaN(num)) return "#ffffff";
    var r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    var chan = [r, g, b].map(function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var bgLum = 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
    var blackLum = 0.2126 * Math.pow((0x18 / 255 + 0.055) / 1.055, 2.4);
    var whiteContrast = (1 + 0.05) / (bgLum + 0.05);
    var blackContrast = (Math.max(bgLum, blackLum) + 0.05) / (Math.min(bgLum, blackLum) + 0.05);
    return whiteContrast >= blackContrast ? "#ffffff" : "#111827";
  }

  // Soft colored glow behind the launcher button, matching whatever color
  // it's actually painted (the bot's primary color, not a fixed per-design
  // tint) — same idea as globals.css's per-preset launcher shadows.
  function softShadow(hex, alpha) {
    var clean = (hex || "#f97316").replace("#", "").trim();
    var full = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean;
    var num = parseInt(full, 16);
    if (full.length !== 6 || isNaN(num)) return "0 8px 20px rgba(249,115,22," + alpha + ")";
    var r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return "0 8px 20px rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

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

  function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

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
    } catch {}
  }

  // ---- Per-design default launcher look (see globals.css's "Assistant
  // Design Presets" for the matching chat-panel styles — each of these 10
  // designs bundles its own launcher button as part of its identity, not
  // just a primaryColor-tinted circle). data-color on the script tag still
  // wins if the embedder explicitly set one, matching every other override
  // in this file.
  // Mirrors src/lib/widget-style.ts's LEGACY_STYLE_MAP — old bots may still
  // have a pre-redesign style id stored in widget_style.
  var LEGACY_STYLE_MAP = {
    liquid: "glassmorphism", neumorphism: "corporate", claymorphism: "playful",
    bento: "minimal", brutalism: "neubrutalism", retro: "dark-sleek", aurora: "gradient-glow",
    minimalist: "minimal", elevated: "corporate", frosted: "glassmorphism",
    bold: "gradient-glow", contrast: "dark-sleek"
  };
  function normalizeDesign(id) {
    if (!id) return "minimal";
    if (LAUNCHER_STYLES[id]) return id;
    return LEGACY_STYLE_MAP[id] || "minimal";
  }
  // dot: the default launcher glyph color, ported 1:1 from the design
  // gallery's own launcher previews (each design shows a plain centered
  // dot as its default mark, not a bot icon — real customer logos still
  // override this once uploaded).
  var LAUNCHER_STYLES = {
    minimal: { bg: "#1c1a15", radius: "50%", shadow: "0 6px 16px rgba(0,0,0,.18)", dot: "#f3f2ee" },
    playful: { bg: "#ff8a5c", radius: "50%", shadow: "0 8px 20px rgba(255,138,92,.45)", dot: "#ffffff" },
    corporate: { bg: "#1c2e4a", radius: "10px", shadow: "0 6px 16px rgba(28,46,74,.3)", dot: "#8fb0dc" },
    "dark-sleek": { bg: "#14141a", radius: "50%", shadow: "0 0 24px rgba(0,229,199,.35)", dot: "#00e5c7" },
    "gradient-glow": { bg: "linear-gradient(135deg,#a855f7,#ec4899)", radius: "50%", shadow: "0 10px 26px rgba(168,85,247,.4)", dot: "#ffffff" },
    glassmorphism: { bg: "rgba(255,255,255,.25)", radius: "50%", shadow: "0 8px 24px rgba(0,0,0,.2)", dot: "#ffffff" },
    ecommerce: { bg: "#0f9d8c", radius: "50%", shadow: "0 8px 20px rgba(15,157,140,.35)", dot: "#ffffff" },
    "healthcare-calm": { bg: "#6f9c7d", radius: "50%", shadow: "0 8px 20px rgba(111,156,125,.35)", dot: "#f4f7f3" },
    neubrutalism: { bg: "#111111", radius: "6px", shadow: "5px 5px 0 0 #111111", dot: "#ffde59" },
    "luxury-editorial": { bg: "#161412", radius: "50%", shadow: "0 8px 22px rgba(0,0,0,.3)", dot: "#b08a3e" }
  };

  // ---- Launcher button ----
  var btn = document.createElement("button");
  btn.setAttribute("aria-label", "Open chat");
  btn.style.cssText =
    "position:fixed;bottom:20px;" + side + ":20px;width:60px;height:60px;border:none;" +
    "border-radius:50%;background:" + color + ";cursor:pointer;z-index:2147483646;" +
    "box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;" +
    "transition:opacity .25s ease,transform .2s ease !important;padding:0;opacity:0 !important;pointer-events:none !important;";
  btn.onmouseenter = function () { btn.style.setProperty("transform", "scale(1.06)", "important"); };
  btn.onmouseleave = function () { btn.style.setProperty("transform", "scale(1)", "important"); };
  var customIconUrl = null;
  var customLogoBgColor = "";
  var avatarIconType = "logo";
  var launcherShape = "circle";
  var currentDesign = normalizeDesign(styleAttr);
  applyLauncherDesign();
  function applyLauncherDesign() {
    var d = LAUNCHER_STYLES[currentDesign];
    if (!d || colorAttr) return; // no matching design, or embedder set an explicit color override
    // Background/shadow follow the bot's own primary color (same treatment
    // as .send-btn in globals.css) rather than each design's fixed tint —
    // radius still comes from the design as an initial default (overridden
    // by the real launcherShape once the theme fetch resolves).
    btn.style.setProperty("background", color, "important");
    btn.style.setProperty("border-radius", d.radius, "important");
    btn.style.setProperty("box-shadow", softShadow(color, 0.4), "important");
    chatIcon = buildChatIcon(color);
    if (!open) btn.innerHTML = chatIcon;
  }
  function getBorderRadiusStyle(shape, side) {
    if (shape === "square") return "0px";
    if (shape === "rounded") return "12px";
    if (shape === "bubble") {
      return side === "left" ? "30px 30px 30px 4px" : "30px 30px 4px 30px";
    }
    return "50%";
  }
  function buildChatIcon(c) {
    var stroke = getOnColor(c);
    var svgIcons = {
      bot: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
      headset: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 1-2 2h1a2 2 0 0 1-2-2v-3a2 2 0 0 1-2-2H3z"/></svg>',
      sparkles: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/><path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z"/><path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/></svg>',
      message: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      user: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
    };

    if (svgIcons[avatarIconType]) {
      return '<div style="width:44px !important;height:44px !important;display:flex !important;align-items:center !important;justify-content:center !important;">' +
             svgIcons[avatarIconType] +
             '</div>';
    }

    // True default (no custom logo uploaded, no icon preset chosen): a plain
    // dot in whatever color contrasts with the launcher's own primary-color
    // background, instead of a fixed per-design tint that might now clash.
    if (avatarIconType === "logo" && !customIconUrl) {
      var dotColor = getOnColor(c);
      return '<div style="width:17px !important;height:17px !important;border-radius:50% !important;background:' + dotColor + ' !important;opacity:.9 !important;"></div>';
    }

    var iconSrc = customIconUrl || (origin + "/favicon.png");
    var isOrange = false;
    if (c && !customIconUrl) {
      var lower = c.toLowerCase().replace(/\s+/g, "");
      isOrange = (
        lower === "#f97316" ||
        lower.indexOf("f97316") !== -1 ||
        lower.indexOf("249,115,22") !== -1
      );
    }
    var filterStyle = isOrange ? "filter: brightness(0) invert(1) !important;" : "";
    var isCustomAvatar = (avatarIconType === "custom");
    if (customIconUrl && !isCustomAvatar) {
      var bgStyle = customLogoBgColor ? "background-color:" + customLogoBgColor + " !important;" : "background-color:rgba(255,255,255,0.2) !important;";
      return '<div style="width:44px !important;height:44px !important;border-radius:50% !important;display:flex !important;align-items:center !important;justify-content:center !important;overflow:hidden !important;' + bgStyle + '">' +
             '<img src="' + iconSrc + '" style="width:34px !important;height:34px !important;display:block !important;object-fit:contain !important;border-radius:50% !important;' + filterStyle + '" alt="Chat" />' +
             '</div>';
    } else {
      var borderStyle = customIconUrl ? "border-radius:50% !important;object-fit:cover !important;" : "object-fit:contain !important;";
      var bgStyle = (customIconUrl && customLogoBgColor) ? "background-color:" + customLogoBgColor + " !important;" : "";
      return '<img src="' + iconSrc + '" style="width:44px !important;height:44px !important;display:block !important;' + borderStyle + filterStyle + bgStyle + '" alt="Chat" />';
    }
  }
  function updateLauncherIcon() {
    chatIcon = buildChatIcon(color);
    if (!open) btn.innerHTML = chatIcon;
  }
  var chatIcon = buildChatIcon(color);
  function closeIcon() {
    var s = getOnColor(color);
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="' + s + '" stroke-width="2.4" stroke-linecap="round"/></svg>';
  }
  function spinnerIcon() {
    var s = getOnColor(color);
    return '<svg width="26" height="26" viewBox="0 0 24 24" style="animation:chatty-spin .7s linear infinite;transform-origin:center">' +
      '<circle cx="12" cy="12" r="9" fill="none" stroke="' + s + '" stroke-opacity=".3" stroke-width="3"/>' +
      '<path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="' + s + '" stroke-width="3" stroke-linecap="round"/></svg>';
  }
  function setBtnIcon() { btn.innerHTML = (pendingOpen || (open && !ready)) ? spinnerIcon() : (open ? closeIcon() : chatIcon); }
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
  function showTeaser(msg) {
    if (open || !teaserEnabled) return;
    if (lsGet("chatty_teaser_" + botId) === "dismissed") return;
    teaserMsg.textContent = msg || teaserText || "👋 Need help? Chat with us.";
    teaser.style.display = "block";
    requestAnimationFrame(function () { teaser.style.opacity = "1"; teaser.style.transform = "translateY(0)"; });
  }
  function hideTeaser() {
    teaser.style.opacity = "0"; teaser.style.transform = "translateY(8px)";
    setTimeout(function () { teaser.style.display = "none"; }, 250);
  }
  teaser.addEventListener("click", function () { hideTeaser(); setOpen(true); });
  teaserClose.addEventListener("click", function (e) { e.stopPropagation(); hideTeaser(); lsSet("chatty_teaser_" + botId, "dismissed"); });

  var triggerRules = [];
  try {
    var rawRules = script.getAttribute("data-rules");
    if (rawRules) triggerRules = JSON.parse(rawRules);
  } catch {}

  // ---- Theme + teaser text from dashboard ----
  // Always apply the database color — even when data-color is set on the script
  // tag — so that dashboard customization changes propagate automatically.
  function applyTheme(c) {
    if (!c) return;
    color = c; btn.style.background = c; chatIcon = buildChatIcon(c);
    if (!open) btn.innerHTML = chatIcon;
  }
  var btnRevealed = false;
  function revealBtn() {
    if (btnRevealed) return;
    btnRevealed = true;
    btn.style.setProperty("opacity", "1", "important");
    btn.style.setProperty("pointer-events", "auto", "important");
  }
  setTimeout(revealBtn, 3000);

  try {
    fetch(BACKEND + "/api/widget/theme?bot_id=" + encodeURIComponent(botId) + "&t=" + new Date().getTime())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d) {
          if (d.primary_color) applyTheme(d.primary_color);
          teaserText = d.teaser_message || d.welcome_message || teaserText;
          if (d.trigger_rules) {
            try {
              var loadedRules = typeof d.trigger_rules === "string" ? JSON.parse(d.trigger_rules) : d.trigger_rules;
              if (Array.isArray(loadedRules)) triggerRules = triggerRules.concat(loadedRules);
            } catch {}
          }
          if (d.widget_style) {
            var parts = d.widget_style.split(":");
            currentDesign = normalizeDesign(parts[0]);
            applyLauncherDesign();
            if (parts.length > 1) {
              customLogoBgColor = parts[1];
            }
            if (parts.length > 2) {
              launcherShape = parts[2] || "circle";
            }
          }
          if (d.avatar_icon) {
            avatarIconType = d.avatar_icon;
          }
          var logoToUse = null;
          if (d.avatar_icon === "custom" && d.avatar_url) {
            logoToUse = d.avatar_url;
          } else if (d.logo_url) {
            logoToUse = d.logo_url;
          }
          customIconUrl = logoToUse;
          updateLauncherIcon();
          btn.style.borderRadius = getBorderRadiusStyle(launcherShape, side);
        }
        revealBtn();
        tryInitTriggers();
      })
      .catch(function () {
        revealBtn();
        tryInitTriggers();
      });
  } catch {
    revealBtn();
    tryInitTriggers();
  }

  // ---- Chat panel (iframe container) ----
  var panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;bottom:92px;" + side + ":20px;width:380px;height:560px;max-width:calc(100vw - 40px);" +
    "max-height:calc(100vh - 120px);border-radius:16px;overflow:hidden;z-index:2147483646;" +
    "box-shadow:0 12px 48px rgba(0,0,0,.28);opacity:0;transform:translateY(12px) scale(.98);" +
    "pointer-events:none;transition:opacity .2s ease,transform .2s ease;background:transparent !important;";

  var iframe = document.createElement("iframe");
  iframe.style.cssText = "width:100% !important;height:100% !important;border:0 !important;display:block !important;border-radius:16px !important;overflow:hidden !important;background:transparent !important;";
  iframe.setAttribute("title", "Chat assistant");
  iframe.setAttribute("allow", "clipboard-write; microphone; notifications");
  var iframeLoaded = false;
  panel.appendChild(iframe);

  window.addEventListener("message", function (e) {
    if (e.origin !== origin) return;
    if (!e.data || typeof e.data !== "object") return;
    if (e.data.type === "chatty-request-notification") {
      if ("Notification" in window) {
        Notification.requestPermission().then(function (perm) {
          var isGranted = (perm === "granted");
          if (isGranted) {
            try {
              new Notification(e.data.botName || "Chatty Support", {
                body: "Notifications enabled! You'll be alerted when support or AI replies.",
                icon: e.data.avatarUrl || undefined
              });
            } catch {}
          }
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: "chatty-notification-status", granted: isGranted }, origin);
          }
        }).catch(function () {});
      } else {
        alert("Browser push notifications are not supported on this browser.");
      }
    } else if (e.data.type === "chatty-trigger-notification") {
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(e.data.botName || "Chatty Support", {
            body: e.data.bodyText || "New message received",
            icon: e.data.avatarUrl || undefined
          });
        } catch {}
      }
    }
  });

  function applyMobile() {
    if (mobileFull && window.innerWidth <= 480) {
      panel.style.setProperty("width", "100vw", "important");
      // 100vh is taller than the visible area on mobile browsers with a
      // collapsible address bar, pushing the panel (anchored at bottom:0)
      // up past the top of the screen and cropping its header off-screen.
      // 100dvh tracks the actual visible viewport; the 100vh line stays as
      // a fallback for browsers that don't understand dvh (setProperty
      // silently no-ops on an unrecognized value, leaving vh in place).
      panel.style.setProperty("height", "100vh", "important");
      panel.style.setProperty("height", "100dvh", "important");
      panel.style.setProperty("max-width", "100vw", "important");
      panel.style.setProperty("max-height", "100vh", "important");
      panel.style.setProperty("max-height", "100dvh", "important");
      panel.style.setProperty("bottom", "0px", "important");
      panel.style.setProperty(side, "0px", "important");
      panel.style.setProperty("border-radius", "0px", "important");
      iframe.style.setProperty("border-radius", "0px", "important");
    } else {
      panel.style.setProperty("width", "380px", "important");
      panel.style.setProperty("height", "560px", "important");
      panel.style.setProperty("max-width", "calc(100vw - 40px)", "important");
      panel.style.setProperty("max-height", "calc(100vh - 120px)", "important");
      panel.style.setProperty("bottom", "92px", "important");
      panel.style.setProperty(side, "20px", "important");
      panel.style.setProperty("border-radius", "16px", "important");
      iframe.style.setProperty("border-radius", "16px", "important");
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
    panel.style.setProperty("opacity", open ? "1" : "0", "important");
    panel.style.setProperty("transform", open ? "none" : "translateY(12px) scale(.98)", "important");
    panel.style.setProperty("pointer-events", open ? "auto" : "none", "important");
    setBtnIcon();
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    // On mobile full-screen, hide the floating launcher while open — the
    // in-panel header close button handles closing, avoiding overlap with the
    // composer's send button.
    var hideLauncher = open && mobileFull && window.innerWidth <= 480;
    btn.style.setProperty("display", hideLauncher ? "none" : "flex", "important");
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

  var triggered = {};
  function triggerRule(rule) {
    var key = rule.type + "_" + String(rule.value || "");
    if (triggered[key]) return;
    triggered[key] = true;
    showTeaser(rule.message);
  }

  var triggersInitialized = false;
  function initTriggers() {
    if (!triggerRules || triggerRules.length === 0) {
      setTimeout(function () { showTeaser(); }, 6000);
      return;
    }

    triggerRules.forEach(function (rule) {
      if (rule.type === "time") {
        setTimeout(function () { triggerRule(rule); }, parseFloat(rule.value || 5) * 1000);
      }
      if (rule.type === "url") {
        try {
          var rx = new RegExp(rule.value || ".*", "i");
          if (rx.test(location.href)) {
            setTimeout(function () { triggerRule(rule); }, 1000);
          }
        } catch {}
      }
    });

    var hasScroll = false;
    var hasExit = false;
    for (var i = 0; i < triggerRules.length; i++) {
      if (triggerRules[i].type === "scroll") hasScroll = true;
      if (triggerRules[i].type === "exit") hasExit = true;
    }

    if (hasScroll) {
      window.addEventListener("scroll", function () {
        var totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight <= 0) return;
        var pct = (window.scrollY / totalHeight) * 100;
        triggerRules.forEach(function (rule) {
          if (rule.type === "scroll" && pct >= parseFloat(rule.value || 50)) {
            triggerRule(rule);
          }
        });
      });
    }

    if (hasExit) {
      document.addEventListener("mouseleave", function (e) {
        if (e.clientY < 20) {
          triggerRules.forEach(function (rule) {
            if (rule.type === "exit") {
              triggerRule(rule);
            }
          });
        }
      });
    }
  }

  var mounted = false;
  function tryInitTriggers() {
    if (mounted && !triggersInitialized) {
      triggersInitialized = true;
      initTriggers();
    }
  }

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
    mounted = true;
    tryInitTriggers();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
