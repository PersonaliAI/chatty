import { defineConfig } from "tsup";
import fs from "node:fs";
import path from "node:path";

export default defineConfig([
  // 1. Standalone bundle for widget.js Shadow DOM
  {
    entry: {
      "chatty-app": "src/standalone.tsx",
    },
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
  // 2. Official React library package (Script Method)
  {
    entry: {
      index: "src/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: false,
    minify: false,
    external: ["react", "react-dom"],
  },
]);
