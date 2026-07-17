import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const configuredWebHostname = (() => {
  try {
    return process.env.WEB_ORIGIN
      ? new URL(process.env.WEB_ORIGIN).hostname
      : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    ...(configuredWebHostname === null ? [] : [configuredWebHostname]),
  ],
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    const apiOrigin =
      process.env.DOGOS_INTERNAL_API_URL ?? "http://127.0.0.1:4000";
    return [
      { source: "/v1/:path*", destination: `${apiOrigin}/v1/:path*` },
      {
        source: "/webhooks/:path*",
        destination: `${apiOrigin}/webhooks/:path*`,
      },
      { source: "/health/:path*", destination: `${apiOrigin}/health/:path*` },
      { source: "/openapi.json", destination: `${apiOrigin}/openapi.json` },
    ];
  },
  turbopack: {
    root: repositoryRoot,
  },
};

export default nextConfig;
