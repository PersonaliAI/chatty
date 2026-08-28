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
  var botId = script && script.getAttribute("data-id");
  if (!botId) {
    console.error("[Chatty] Missing data-id on widget script tag.");
    return;
  }

  // window.Chatty.open()/.close()/.toggle() — queued until the widget has
  // actually mounted and reported its API back via onApiReady below, so a
  // call made right after the script tag (a common pattern) isn't dropped.
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

  var colorAttr = script.getAttribute("data-color");
  var styleAttr = script.getAttribute("data-style");
  var position = script.getAttribute("data-position") || "right"; // right | left
  var mobileFull = (script.getAttribute("data-mobile-fullscreen") || "true") !== "false";
  var teaserEnabled = (script.getAttribute("data-teaser") || "true") !== "false";
  var soundEnabled = (script.getAttribute("data-sound") || "true") !== "false";
  var origin = new URL(script.src, location.href).origin;

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

    var container = (typeof host.attachShadow === "function") ? host.attachShadow({ mode: "open" }) : host;

    // Inject encapsulated widget stylesheet into Shadow DOM
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = origin + "/chatty-app.css";
    container.appendChild(link);

    function doMount() {
      if (window.ChattyDOM && window.ChattyDOM.mount) {
        window.ChattyDOM.mount(container, {
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
      appScript.src = origin + "/chatty-app.js";
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
