import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Allow the portfolio site (and the app itself) to embed any page in an iframe.
        // No X-Frame-Options is set anywhere, so this CSP is the single source of truth.
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://alexandergould.dev https://www.alexandergould.dev",
          },
        ],
      },
      {
        source: "/version.json",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://alexandergould.dev" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
