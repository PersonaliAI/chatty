// Chatty AI - Embeddable Chat Widget Loader
// Loads the widget in an isolated Shadow DOM container to prevent any CSS bleed
(function () {
  "use strict";

  if (window.__chatty_loaded || window.__chattyWidgetLoaded) return;

  // Suppress indexing crawlers, but do not block headless browsers
  var ua = (navigator.userAgent || "").toLowerCase();
  var isBot = /jina|crawler|spider|scraper|lighthouse/i.test(ua);
  if (isBot) return;

  // Don't mount floating widget over dashboard editor, embed preview, or kb page
  var path = (window.location.pathname || "").toLowerCase();
  if (path.startsWith("/dashboard") || path.startsWith("/embed/") || path.startsWith("/kb/")) return;

  window.__chatty_loaded = true;
  window.__chattyWidgetLoaded = true;

  // Find the loader script tag to read data attributes
  var script =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        var s = scripts[i];
        if (
          s.src &&
          (s.src.indexOf("/widget.js") !== -1 ||
            s.getAttribute("data-id") ||
            s.getAttribute("data-bot-id") ||
            (s.dataset && (s.dataset.id || s.dataset.botId)))
        ) {
          return s;
        }
      }
      return null;
    })();

  // Prioritize configured bot ID on script tag, then URL param, then window global
  var botId =
    (script &&
      (script.getAttribute("data-id") ||
        script.getAttribute("data-bot-id") ||
        (script.dataset && (script.dataset.id || script.dataset.botId)))) ||
    (function () {
      if (!script || !script.src) return "";
      try {
        var url = new URL(script.src, location.href);
        return (
          url.searchParams.get("bot_id") ||
          url.searchParams.get("id") ||
          url.searchParams.get("botId") ||
          ""
        );
      } catch (e) {
        return "";
      }
    })() ||
    window.CHATTY_BOT_ID ||
    "";

  if (!botId) {
    console.warn(
      "[Chatty] No bot ID provided. Add data-id or data-bot-id to your script tag."
    );
    return;
  }

  // Support for optional widget configuration attributes
  var colorAttr =
    (script &&
      (script.getAttribute("data-color") ||
        (script.dataset && script.dataset.color))) ||
    null;
  var styleAttr =
    (script &&
      (script.getAttribute("data-style") ||
        (script.dataset && script.dataset.style))) ||
    null;
  var position =
    (script &&
      (script.getAttribute("data-position") ||
        (script.dataset && script.dataset.position))) ||
    "bottom-right";
  var mobileFull =
    ((script &&
      (script.getAttribute("data-mobile-fullscreen") ||
        (script.dataset && script.dataset.mobileFullscreen))) ||
      "true") !== "false";
  var teaserEnabled =
    ((script &&
      (script.getAttribute("data-teaser") ||
        (script.dataset && script.dataset.teaser))) ||
      "true") !== "false";
  var soundEnabled =
    ((script &&
      (script.getAttribute("data-sound") ||
        (script.dataset && script.dataset.sound))) ||
      "true") !== "false";
  var mode =
    (script &&
      (script.getAttribute("data-mode") ||
        (script.dataset && script.dataset.mode))) ||
    "chat"; // chat | voice
  var display =
    (script &&
      (script.getAttribute("data-display") ||
        (script.dataset && script.dataset.display))) ||
    "drawer"; // drawer | modal
  var launcher =
    (script &&
      (script.getAttribute("data-launcher") ||
        (script.dataset && script.dataset.launcher))) ||
    "visible"; // visible | none
  var origin =
    script && script.src
      ? new URL(script.src, location.href).origin
      : "https://chatty.personaliai.com";

  // Cache-buster for chatty-app.js/.css: they're served from a fixed,
  // unversioned URL, and browsers cache script/link responses even under
  // Cache-Control: max-age=0 (a conditional revalidation can still resolve
  // to a stale disk-cache entry). Whenever chatty-app.js's exported API
  // shape changes (e.g. window.ChattyDOM's methods), a visitor with an old
  // cached copy silently gets an app that doesn't match what this file
  // expects - doMount()'s `window.ChattyDOM.mount` check just no-ops with
  // no error, so the widget never appears. Bump this on every release that
  // changes the widget shell or embedded chat surface so customer sites
  // do not keep loading a stale cached UI bundle.
  var ASSET_VERSION = "2026-10-23.v4-clean-footer-scroll";

  // Preconnect to origin for fast asset loading
  try {
    var pc = document.createElement("link");
    pc.rel = "preconnect";
    pc.href = origin;
    document.head.appendChild(pc);
  } catch (e) {}

  // JavaScript API queue: support both window.Chatty(...) and window.Chatty.open()
  var chattyApi = null;
  var pendingCalls = [];
  function queueOrCall(name) {
    return function () {
      if (chattyApi && typeof chattyApi[name] === "function") {
        return chattyApi[name].apply(chattyApi, arguments);
      } else {
        pendingCalls.push({ name: name, args: arguments });
      }
    };
  }

  var ChattyProxy = function () {
    if (chattyApi && arguments.length > 0) {
      var method = arguments[0];
      if (typeof chattyApi[method] === "function") {
        return chattyApi[method].apply(chattyApi, Array.prototype.slice.call(arguments, 1));
      }
    }
    (ChattyProxy.q = ChattyProxy.q || []).push(arguments);
  };
  ChattyProxy.q = (window.Chatty && window.Chatty.q) || [];
  ChattyProxy.identify = queueOrCall("identify");
  ChattyProxy.logout = queueOrCall("logout");
  ChattyProxy.open = queueOrCall("open");
  ChattyProxy.openVoice = queueOrCall("openVoice");
  ChattyProxy.close = queueOrCall("close");
  ChattyProxy.toggle = queueOrCall("toggle");
  window.Chatty = ChattyProxy;

  function init() {
    // Isolated custom element to host Shadow DOM
    var host = document.createElement("div");
    host.id = "chatty-widget-host";
    host.style.cssText =
      "position:fixed;bottom:0;right:0;width:auto;height:auto;z-index:2147483646;pointer-events:none;";
    document.body.appendChild(host);

    var shadow =
      typeof host.attachShadow === "function"
        ? host.attachShadow({ mode: "open" })
        : host;

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
          mode: mode,
          display: display,
          launcher: launcher,
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
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function onApiReady(api) {
    chattyApi = api;
    for (var i = 0; i < pendingCalls.length; i++) {
      var c = pendingCalls[i];
      if (typeof api[c.name] === "function") {
        api[c.name].apply(api, c.args);
      }
    }
    pendingCalls = [];
    if (window.Chatty && window.Chatty.q) {
      var q = window.Chatty.q;
      for (var j = 0; j < q.length; j++) {
        var args = Array.prototype.slice.call(q[j]);
        var method = args[0];
        if (typeof api[method] === "function") {
          api[method].apply(api, args.slice(1));
        }
      }
      window.Chatty.q = [];
    }
    try {
      window.dispatchEvent(new CustomEvent("chatty:ready", { detail: { botId: botId } }));
    } catch (e) {}
  }
})();
