import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
        // Same reasoning as /widget.js above, and just as important: these
        // are the standalone widget bundle (Vite build via `npm run
        // build:widget`), served under an UNHASHED filename that changes
        // content on every deploy. Without an explicit no-store here, a CDN
        // edge (or the browser) that cached an old response has no signal
        // to ever refetch — every deploy after the first would silently
        // keep serving a stale/mismatched bundle to some fraction of
        // visitors, indistinguishable from the widget randomly breaking.
        source: "/widget-app.:ext(js|css)",
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
