/* Chatty embeddable support widget loader (Crisp-Style Direct Shadow DOM).
 * Usage:
 *   <script src="https://chatty.personaliai.com/widget.js"
 *           data-id="YOUR_BOT_UUID" data-color="#f97316" data-style="minimalist" defer></script>
 *
 * Injects a native vector DOM chat assistant directly into an isolated Shadow DOM container.
 * 100% Crisp-level vector font sharpness at all zoom levels, zero iframe bitmap scaling.
 *
 * JS API: window.Chatty.open() / .close() / .toggle()
 */
(function () {
  "use strict";
  if (window.__chattyWidgetLoaded) return;

  // Exit immediately if loaded by a crawler, headless browser, or scraper
  var ua = (navigator.userAgent || "").toLowerCase();
  var isBot = /jina|bot|crawl|spider|headless|lighthouse/i.test(ua) || navigator.webdriver;
  if (isBot) return;

  // Don't mount floating widget over dashboard editor or embed iframe preview
  var path = (window.location.pathname || "").toLowerCase();
  if (path.startsWith("/dashboard") || path.startsWith("/embed/") || path.startsWith("/kb/")) return;

  window.__chattyWidgetLoaded = true;

  var script = document.currentScript;
  if (!script) {
    var all = document.getElementsByTagName("script");
    for (var i = 0; i < all.length; i++) {
      if ((all[i].src || "").indexOf("widget.js") !== -1) {
        script = all[i];
        break;
      }
    }
  }

  var botId = script && (
    script.getAttribute("data-id") ||
    script.getAttribute("data-bot-id") ||
    (script.dataset && (script.dataset.id || script.dataset.botId))
  );

  if (!botId && window.CHATTY_BOT_ID) {
    botId = window.CHATTY_BOT_ID;
  }

  if (!botId) {
    console.error("[Chatty] Missing data-id on widget script tag.");
    return;
  }

  // window.Chatty.open()/.close()/.toggle() — queued until the widget has
  // actually mounted and reported its API back via onApiReady below
  var chattyApi = null;
  var pendingCalls = [];
  function queueOrCall(name) {
    return function () {
      if (chattyApi) chattyApi[name]();
      else pendingCalls.push(name);
    };
  }
  window.Chatty = {
    open: queueOrCall("open"),
    close: queueOrCall("close"),
    toggle: queueOrCall("toggle"),
  };
  function onApiReady(api) {
    chattyApi = api;
    for (var i = 0; i < pendingCalls.length; i++) api[pendingCalls[i]]();
    pendingCalls = [];
  }

  var colorAttr = script && (script.getAttribute("data-color") || (script.dataset && script.dataset.color));
  var styleAttr = script && (script.getAttribute("data-style") || (script.dataset && script.dataset.style));
  var position = (script && (script.getAttribute("data-position") || (script.dataset && script.dataset.position))) || "right"; // right | left
  var mobileFull = ((script && (script.getAttribute("data-mobile-fullscreen") || (script.dataset && script.dataset.mobileFullscreen))) || "true") !== "false";
  var teaserEnabled = ((script && (script.getAttribute("data-teaser") || (script.dataset && script.dataset.teaser))) || "true") !== "false";
  var soundEnabled = ((script && (script.getAttribute("data-sound") || (script.dataset && script.dataset.sound))) || "true") !== "false";
  var origin = (script && script.src) ? new URL(script.src, location.href).origin : "https://chatty.personaliai.com";

  // Cache-buster for chatty-app.js/.css: they're served from a fixed,
  // unversioned URL, and browsers cache script/link responses even under
  // Cache-Control: max-age=0 (a conditional revalidation can still resolve
  // to a stale disk-cache entry). Whenever chatty-app.js's exported API
  // shape changes (e.g. window.ChattyDOM's methods), a visitor with an old
  // cached copy silently gets an app that doesn't match what this file
  // expects — doMount()'s `window.ChattyDOM.mount` check just no-ops with
  // no error, so the widget never appears. Bump this on every release that
  // changes chatty-app.js/css in a way that matters (not just cosmetic).
  var ASSET_VERSION = "2026-09-02.4";

  // Preconnect to origin for fast asset loading
  try {
    var pc = document.createElement("link");
    pc.rel = "preconnect";
    pc.href = origin;
    pc.crossOrigin = "anonymous";
    document.head.appendChild(pc);
  } catch {}

  function mountShadowWidget() {
    var host = document.createElement("div");
    host.id = "chatty-widget-host";
    host.style.cssText = "position:fixed;bottom:0;right:0;width:auto;height:auto;z-index:2147483646;pointer-events:none;";
    document.body.appendChild(host);

    var shadow = (typeof host.attachShadow === "function") ? host.attachShadow({ mode: "open" }) : host;

    // Inject encapsulated widget stylesheet into Shadow DOM
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = origin + "/chatty-app.css?v=" + ASSET_VERSION;
    shadow.appendChild(link);

    // Dedicated mounting node so React createRoot doesn't interfere with the link tag
    var mountNode = document.createElement("div");
    mountNode.id = "chatty-app-root";
    shadow.appendChild(mountNode);

    function doMount() {
      if (window.ChattyDOM && window.ChattyDOM.mount) {
        window.ChattyDOM.mount(mountNode, {
          botId: botId,
          color: colorAttr,
          style: styleAttr,
          position: position,
          mobileFullscreen: mobileFull,
          teaserEnabled: teaserEnabled,
          soundEnabled: soundEnabled,
          onApiReady: onApiReady,
        });
      }
    }

    if (window.ChattyDOM && window.ChattyDOM.mount) {
      doMount();
    } else {
      var appScript = document.createElement("script");
      appScript.src = origin + "/chatty-app.js?v=" + ASSET_VERSION;
      appScript.async = true;
      appScript.onload = doMount;
      document.head.appendChild(appScript);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountShadowWidget);
  } else {
    mountShadowWidget();
  }
})();
