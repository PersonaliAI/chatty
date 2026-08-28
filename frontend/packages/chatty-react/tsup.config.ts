import { defineConfig } from "tsup";
import fs from "node:fs";
import path from "node:path";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "widget-style": "src/widget-style.ts",
      "color-contrast": "src/color-contrast.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    platform: "browser",
    external: ["react", "react-dom", "react/jsx-runtime"],
    noExternal: [
      "framer-motion",
      "react-markdown",
      "remark-gfm",
      "remark-math",
      "rehype-katex",
      "katex",
      "lucide-react",
      "emoji-picker-react",
      "livekit-client",
    ],
    onSuccess: async () => {
      fs.copyFileSync("src/widget-presets.css", "dist/styles.css");
    },
  },
  {
    entry: {
      "chatty-app": "src/standalone.tsx",
    },
    // No `globalName` here: esbuild's IIFE globalName wrapper assigns the
    // module's *entire export namespace* (ChattyStandaloneApp, mountChatty,
    // mountChattyPanel — the raw, unaliased names) to `window.ChattyDOM` as
    // the very last thing the bundle does, which silently overwrote the
    // real `window.ChattyDOM = { mount, mountPanel }` assignment standalone.tsx
    // makes itself lower in the same file (evaluation order: esbuild's own
    // assignment is the IIFE's completion value, so it always runs last and
    // wins). widget.js calls `window.ChattyDOM.mount(...)`, which the
    // clobbered shape doesn't have — the widget silently never mounted.
    format: ["iife"],
    sourcemap: false,
    minify: true,
    platform: "browser",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    noExternal: [/.*/],
    onSuccess: async () => {
      const srcJs = path.resolve("dist/chatty-app.global.js");
      const destJs = path.resolve("../../public/chatty-app.js");
      if (fs.existsSync(srcJs)) {
        fs.copyFileSync(srcJs, destJs);
      }
      const srcCss = path.resolve("dist/chatty-app.css");
      const destCss = path.resolve("../../public/chatty-app.css");
      if (fs.existsSync(srcCss)) {
        fs.copyFileSync(srcCss, destCss);
      }
    },
  },
]);

