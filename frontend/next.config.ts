import type { NextConfig } from "next";
import { cspOptionsFromEnv, publicCsp, securityHeaders } from "./src/lib/security-headers";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Product photos on Cloudinary (only this account's when its name is set). */
const CLOUDINARY_PATH = process.env.CLOUDINARY_CLOUD_NAME
  ? `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/**`
  : "/*/image/upload/**";

const csp = cspOptionsFromEnv();

const nextConfig: NextConfig = {
  // @rassm/shared ships TypeScript source, so Next compiles it.
  transpilePackages: ["@rassm/shared"],
  poweredByHeader: false,

  // next/image resizes the Cloudinary photos and serves WebP / AVIF to each screen.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: CLOUDINARY_PATH },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // The dashboard calls the admin API on the site's own domain: the session cookie is a
  // first-party cookie of the site (readable by proxy.ts), whatever domain the API has.
  async rewrites() {
    return [{ source: "/api/admin/:path*", destination: `${API_URL}/api/admin/:path*` }];
  },

  // Security headers everywhere; the public pages' Content-Security-Policy (the dashboard gets
  // a stricter one with a nonce from proxy.ts). The dashboard is never indexed.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders(csp) },
      {
        source: "/((?!admin(?:/|$)).*)",
        headers: [{ key: "Content-Security-Policy", value: publicCsp(csp) }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/admin",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
