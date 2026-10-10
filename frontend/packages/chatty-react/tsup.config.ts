import { defineConfig } from "tsup";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const frontendNodeModules = path.resolve(packageDir, "../../node_modules");

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
    // The package is built from its own workspace directory, while the
    // LiveKit component package is resolved from the frontend workspace.
    // Without a single canonical React path, esbuild can embed two copies of
    // React in the IIFE. LiveKit hooks then run against a different React
    // dispatcher than the renderer and fail with `useContext` reading null
    // as soon as the voice surface mounts.
    esbuildOptions: (options) => {
      options.alias = {
        ...(options.alias ?? {}),
        // The shared voice panel is authored in the Next app and uses the
        // same @/* imports as the dashboard preview. Keep the standalone
        // widget on that exact source instead of maintaining a second voice
        // implementation.
        "@": path.resolve(packageDir, "../../src"),
        react: path.join(frontendNodeModules, "react"),
        "react/jsx-runtime": path.join(frontendNodeModules, "react/jsx-runtime.js"),
        "react/jsx-dev-runtime": path.join(frontendNodeModules, "react/jsx-dev-runtime.js"),
        "react/compiler-runtime": path.join(frontendNodeModules, "react/compiler-runtime.js"),
        "react-dom": path.join(frontendNodeModules, "react-dom"),
        "react-dom/client": path.join(frontendNodeModules, "react-dom/client.js"),
      };
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
    external: ["react", "react-dom", "@livekit/components-react", "@livekit/components-styles", "livekit-client"],
    esbuildOptions: (options) => {
      options.alias = {
        ...(options.alias ?? {}),
        "@": path.resolve(packageDir, "../../src"),
      };
    },
  },
]);
