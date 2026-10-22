import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  // Allow HMR when the dev server is opened via 127.0.0.1 instead of localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // sharp ships native binaries; keep it out of the server bundle.
  serverExternalPackages: ["sharp"],
  // ...but trace them into the standalone output for routes that import lib/uploads.
  // On Windows @vercel/nft cannot run ldd, so the .so files are missing there.
  outputFileTracingIncludes: {
    "/api/upload": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
    "/uploads/[...path]": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
    "/admin/media": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
  experimental: {
    serverActions: {
      // Post bodies are sent through a Server Action; images go via /api/upload.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
