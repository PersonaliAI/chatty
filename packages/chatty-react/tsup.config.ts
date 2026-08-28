import { defineConfig } from "tsup";
import fs from "node:fs";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: "browser",
  external: ["react", "react-dom", "react/jsx-runtime"],
  // Bundle everything else (framer-motion, react-markdown, katex, etc.) so
  // consumers only need `react`/`react-dom` as peer deps — same trade-off
  // widget-app.js already made for the standalone <script> bundle, just
  // without the IIFE/global-mount wrapper since this ships as an ES/CJS
  // module for the consumer's own bundler to import. A blanket /.*/ pattern
  // here would also swallow the `external` entries above (esbuild doesn't
  // prioritize external over a catch-all noExternal), silently bundling a
  // second copy of React in — the exact "Invalid hook call" bug this
  // explicit dependency list avoids.
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
});
