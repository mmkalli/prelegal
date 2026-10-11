import type { NextConfig } from "next";

// The production build (Docker) is a static export served by the FastAPI backend. In
// development, `next dev` proxies /api to a locally running backend instead, because rewrites
// are not supported in export mode. Cache Components / partial prefetching are not enabled:
// they rely on PPR, which cannot run in a static export.
const isExport = process.env.NEXT_OUTPUT === "export";
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(isExport
    ? // Emit /login/index.html etc. so the backend can serve each route as a directory index.
      { output: "export", trailingSlash: true }
    : {
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
        },
      }),
};

export default nextConfig;
