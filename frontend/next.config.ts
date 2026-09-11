import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright's deterministic local server uses 127.0.0.1. Allow it in
  // development so browser checks exercise real client bundles without
  // cross-origin dev-resource warnings.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        // Thin loader: revalidate quickly so widget updates propagate fast
        // (Crisp-style), instead of being edge-cached for hours.
        source: "/widget.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
        ],
      },
      {
        source: "/logos/:file*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
