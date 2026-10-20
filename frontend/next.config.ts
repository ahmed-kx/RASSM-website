import type { NextConfig } from "next";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Product photos on Cloudinary (only this account's when its name is set). */
const CLOUDINARY_PATH = process.env.CLOUDINARY_CLOUD_NAME
  ? `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/**`
  : "/*/image/upload/**";

const nextConfig: NextConfig = {
  // @rassm/shared ships TypeScript source, so Next compiles it.
  transpilePackages: ["@rassm/shared"],

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

  // The dashboard is never indexed (also set in its metadata).
  async headers() {
    return [
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
