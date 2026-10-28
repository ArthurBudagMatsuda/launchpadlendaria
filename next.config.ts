import type { NextConfig } from "next";
const staticExport = process.env.RETRY_STATIC_EXPORT === "1";
const config: NextConfig = {
  poweredByHeader: false,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  ...(staticExport
    ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
    : {}),
  headers: staticExport
    ? undefined
    : async () => {
        return [
          {
            source: "/:path*",
            headers: [
              { key: "X-Content-Type-Options", value: "nosniff" },
              {
                key: "Referrer-Policy",
                value: "strict-origin-when-cross-origin",
              },
              { key: "X-Frame-Options", value: "DENY" },
              {
                key: "Permissions-Policy",
                value: "camera=(), microphone=(), geolocation=()",
              },
            ],
          },
        ];
      },
};
export default config;
