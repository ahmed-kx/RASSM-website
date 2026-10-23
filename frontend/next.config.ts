import type { NextConfig } from "next";
import { cspOptionsFromEnv, publicCsp, securityHeaders } from "./src/lib/security-headers";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Product photos on Cloudinary (only this account's when its name is set). */
const CLOUDINARY_PATH = process.env.CLOUDINARY_CLOUD_NAME
  ? `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/**`
  : "/*/image/upload/**";

const csp = cspOptionsFromEnv();

/**
 * The dashboard's own host (e.g. admin.rassmstore.live), when it runs on a subdomain. Then the
 * dashboard and its API calls only exist on that host (its `__Host-` cookies never reach the
 * public site, and scripts of the public pages, the Meta Pixel included, never run next to them),
 * and that host shows nothing else. Empty = the dashboard is at /admin on the site itself.
 */
const ADMIN_HOST = process.env.ADMIN_HOST?.trim() || "";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
/** `has` / `missing` condition (the value is a regular expression: dots escaped). */
const onAdminHost = [{ type: "host" as const, value: ADMIN_HOST.replace(/\./g, "\\.") }];

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

  // The dashboard calls the admin API on its own domain: the session cookie is a first-party
  // cookie of that host (readable by proxy.ts), whatever domain the API has. proxy.ts adds the
  // visitor's signed IP first.
  async rewrites() {
    return [
      {
        source: "/api/admin/:path*",
        destination: `${API_URL}/api/admin/:path*`,
        ...(ADMIN_HOST && { has: onAdminHost }),
      },
    ];
  },

  // Dashboard on its own subdomain (ADMIN_HOST): /admin on the public site goes there, and the
  // dashboard host sends any other page back to the public site.
  async redirects() {
    if (!ADMIN_HOST) return [];
    return [
      {
        source: "/admin/:path*",
        missing: onAdminHost,
        destination: `https://${ADMIN_HOST}/admin/:path*`,
        permanent: false,
      },
      {
        source: "/admin",
        missing: onAdminHost,
        destination: `https://${ADMIN_HOST}/admin`,
        permanent: false,
      },
      { source: "/", has: onAdminHost, destination: "/admin", permanent: false },
      {
        // Every page but the dashboard, its API and Next.js / public files.
        source: "/:path((?!admin(?:/|$)|api/admin/|_next/|.*\\.[A-Za-z0-9]+$).+)",
        has: onAdminHost,
        destination: `${SITE_URL}/:path`,
        permanent: false,
      },
    ];
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
