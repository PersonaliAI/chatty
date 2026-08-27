import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Standalone build for the public chat widget (Stage 2 of the cross-origin
// iframe → Shadow DOM rewrite — see C:\Users\HP\.claude\plans\gleaming-watching-sunrise.md).
// Produces a single IIFE bundle + single CSS file, emitted straight into
// public/ so they're served as static assets by the same Next.js app,
// deployed through the existing pipeline. Run via `npm run build:widget`,
// separately from `next build`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Vite doesn't polyfill process.env like webpack/Next.js does — several
    // bundled dependencies (react-dom's dev-mode checks in particular) read
    // process.env.NODE_ENV directly with no `typeof process` guard, which
    // throws ReferenceError at runtime in a plain browser <script> with no
    // process global at all. Replacing it at build time (esbuild inlines
    // the literal, removing the runtime reference entirely) fixes that.
    "process.env.NODE_ENV": JSON.stringify("production"),
    // ChatWidgetCore reads this one var directly (shared with the Next.js
    // build), so inline it the same way.
    "process.env.NEXT_PUBLIC_BACKEND_URL": JSON.stringify(
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com"
    ),
  },
  publicDir: false,
  build: {
    outDir: "public",
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "./src/widget-entry.tsx"),
      formats: ["iife"],
      name: "ChattyWidgetApp",
      fileName: () => "widget-app.js",
    },
    rollupOptions: {
      output: {
        // Single-file IIFE — no separate vendor chunks, this is loaded as a
        // plain <script> from third-party sites, same as widget.js today.
        assetFileNames: (info) => (info.names?.[0]?.endsWith(".css") ? "widget-app.css" : "assets/[name][extname]"),
      },
    },
  },
});
