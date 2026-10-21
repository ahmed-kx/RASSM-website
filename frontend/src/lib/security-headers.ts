// HTTP security headers of the website (next.config.ts) and the dashboard (proxy.ts).
//
// The public pages are prerendered and cached (fast for customers), so their policy cannot
// carry a per-request nonce: inline scripts are allowed (Next.js writes its page data that
// way) but scripts only load from the site and Meta. The dashboard is rendered on every request
// and gets the strict policy: a fresh nonce, no inline script without it ('strict-dynamic').

const META_SCRIPTS = "https://connect.facebook.net";
const META_EVENTS = "https://www.facebook.com";
const CLOUDINARY = "https://res.cloudinary.com";

export interface CspOptions {
  /** Origin of the API called by the browser (order, contact, newsletter forms). */
  apiOrigin: string;
  /** Development: React needs eval for its error overlay. */
  dev: boolean;
  /** The site runs on https (production): ask browsers to upgrade any http request. */
  https: boolean;
}

const join = (directives: Record<string, (string | false)[]>) =>
  Object.entries(directives)
    .map(([name, values]) => [name, ...values.filter(Boolean)].join(" "))
    .join("; ");

const common = ({ https }: CspOptions) => ({
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  // Never shown inside another site's frame (clickjacking).
  "frame-ancestors": ["'none'"],
  ...(https ? { "upgrade-insecure-requests": [] } : {}),
});

/** Public site: our scripts and the Meta Pixel; images from the site, Cloudinary and Meta. */
export function publicCsp(options: CspOptions): string {
  return join({
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", META_SCRIPTS, options.dev && "'unsafe-eval'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", CLOUDINARY, META_EVENTS],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", options.apiOrigin, META_EVENTS, META_SCRIPTS],
    "frame-src": ["'none'"],
    ...common(options),
  });
}

/** Dashboard: only scripts carrying this request's nonce (and the ones they load). */
export function adminCsp(options: CspOptions & { nonce: string }): string {
  return join({
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${options.nonce}'`,
      "'strict-dynamic'",
      options.dev && "'unsafe-eval'",
    ],
    // Inline style attributes (charts, image sizes) cannot carry a nonce.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", CLOUDINARY],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"],
    "frame-src": ["'none'"],
    ...common(options),
  });
}

/** Headers of every page and file. */
export function securityHeaders({ https }: Pick<CspOptions, "https">) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Two years of HTTPS only, once the site is on https (never on localhost).
    ...(https
      ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
      : []),
  ];
}

/** The options from the environment (same in next.config.ts and proxy.ts). */
export function cspOptionsFromEnv(): CspOptions {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  return {
    apiOrigin: new URL(api).origin,
    dev: process.env.NODE_ENV === "development",
    https: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
  };
}
