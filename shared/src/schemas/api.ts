import { z } from "zod";
import { contactFormSchema, newsletterFormSchema } from "./forms";
import { productOrderSchema } from "./product-order";

// Request and response shapes of the public API, shared by the backend and the frontend.

/** Paths of the public API, relative to the API base URL. */
export const API_PATHS = {
  products: "/api/products",
  product: (slug: string) => `/api/products/${encodeURIComponent(slug)}`,
  deliveryFees: "/api/delivery-fees",
  orders: "/api/orders",
  contactMessages: "/api/contact-messages",
  newsletter: "/api/newsletter",
  /** The link of the confirmation e-mail (double opt-in) is checked here. */
  newsletterConfirm: "/api/newsletter/confirm",
} as const;

/**
 * Admin API paths. The dashboard calls them on the site's own domain: Next.js rewrites
 * /api/admin/* to the API, so the session cookie is a first-party cookie of the site.
 */
export const ADMIN_API_PATHS = {
  login: "/api/admin/auth/login",
  logout: "/api/admin/auth/logout",
  me: "/api/admin/auth/me",
  forgotPassword: "/api/admin/auth/password/forgot",
  resetPassword: "/api/admin/auth/password/reset",
  sessions: "/api/admin/security/sessions",
  session: (id: string) => `/api/admin/security/sessions/${encodeURIComponent(id)}`,
  otherSessions: "/api/admin/security/sessions/others",
  changePassword: "/api/admin/security/password",
  orders: "/api/admin/orders",
  orderUpdates: "/api/admin/orders/updates",
  order: (id: string) => `/api/admin/orders/${encodeURIComponent(id)}`,
  orderStatus: (id: string) => `/api/admin/orders/${encodeURIComponent(id)}/status`,
  orderNote: (id: string) => `/api/admin/orders/${encodeURIComponent(id)}/note`,
  orderTest: (id: string) => `/api/admin/orders/${encodeURIComponent(id)}/test`,
  orderBlacklist: (id: string) => `/api/admin/orders/${encodeURIComponent(id)}/blacklist`,
  andersonExport: "/api/admin/orders/export",
  bulkShip: "/api/admin/orders/ship",
  bulkCancel: "/api/admin/orders/cancel",
  blacklist: "/api/admin/blacklist",
  blacklistEntry: (phone: string) => `/api/admin/blacklist/${encodeURIComponent(phone)}`,
  search: "/api/admin/search",
  products: "/api/admin/products",
  product: (id: string) => `/api/admin/products/${encodeURIComponent(id)}`,
  productStock: (id: string) => `/api/admin/products/${encodeURIComponent(id)}/stock`,
  productFlags: (id: string) => `/api/admin/products/${encodeURIComponent(id)}/flags`,
  productDuplicate: (id: string) => `/api/admin/products/${encodeURIComponent(id)}/duplicate`,
  uploads: "/api/admin/uploads",
  deliveryFees: "/api/admin/delivery-fees",
  deliveryFee: (code: number) => `/api/admin/delivery-fees/${code}`,
  deliveryBulk: "/api/admin/delivery-fees/bulk",
  settings: "/api/admin/settings",
  stats: "/api/admin/stats",
  ads: "/api/admin/ads",
  ad: (id: string) => `/api/admin/ads/${encodeURIComponent(id)}`,
  clients: "/api/admin/clients",
  clientsExport: "/api/admin/clients/export",
  client: (phone: string) => `/api/admin/clients/${encodeURIComponent(phone)}`,
  messages: "/api/admin/messages",
  message: (id: string) => `/api/admin/messages/${encodeURIComponent(id)}`,
  subscribers: "/api/admin/subscribers",
  subscribersExport: "/api/admin/subscribers/export",
  subscriber: (id: string) => `/api/admin/subscribers/${encodeURIComponent(id)}`,
  subscriberSync: (id: string) => `/api/admin/subscribers/${encodeURIComponent(id)}/sync`,
} as const;

/** Name of the admin session cookie (httpOnly, set by the API). See `adminCookieName`. */
export const ADMIN_SESSION_COOKIE = "rassm_admin";
/** Long-lived random id of a browser (httpOnly): a login from an unknown one sends an alert. */
export const ADMIN_DEVICE_COOKIE = "rassm_device";

/**
 * The real name of an admin cookie. Over HTTPS (production) it carries the `__Host-` prefix: the
 * browser then only accepts it from this exact host, Secure, on path "/", never shared with a
 * subdomain. Plain http (development, tests) cannot use the prefix.
 */
export function adminCookieName(name: string, secure: boolean): string {
  return secure ? `__Host-${name}` : name;
}

/**
 * Anti-CSRF token of the session. The API gives it in the answer of the login and of
 * `GET /auth/me` (never in a cookie, so other scripts of the site cannot read it); the dashboard
 * keeps it in memory and sends it back in this header with every change (POST, PUT, PATCH,
 * DELETE). Another site can neither read it nor guess it.
 */
export const ADMIN_CSRF_HEADER = "x-csrf-token";
/** The API's answer when the token is missing or stale: the dashboard fetches it and retries. */
export const CSRF_REFUSED_MESSAGE = "Requête refusée. Rechargez la page puis réessayez.";

/**
 * Dashboard requests go through the website (Next.js rewrites /api/admin to the API). The site
 * sends the visitor's IP in these headers, signed with ADMIN_PROXY_SECRET, so the API never has
 * to trust an X-Forwarded-For header, which any visitor can forge.
 */
export const CLIENT_IP_HEADER = "x-rassm-client-ip";
export const CLIENT_IP_SIGNATURE_HEADER = "x-rassm-client-ip-signature";
/** A signature older than this is refused (replayed request). */
export const CLIENT_IP_SIGNATURE_MAX_AGE_MS = 60_000;

/** "<time>.<HMAC-SHA256 hex of `<time>.<ip>`>", with Web Crypto (works in Node and Next.js). */
export async function signClientIp(secret: string, ip: string, time: number): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${time}.${ip}`));
  const hex = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${time}.${hex}`;
}

/**
 * Hidden anti-spam field ("honeypot") of the order, contact and newsletter forms. People never see it
 * and leave it empty; bots fill every field. When it is filled, the API answers as if it
 * worked and saves nothing.
 */
export const HONEYPOT_FIELD = "website";
const honeypotSchema = z.string().max(500).optional();

/** "fb.1.1712345678901.AbCdEf…": the Meta `_fbp` / `_fbc` cookies. Invalid values are dropped. */
const metaCookieSchema = z
  .string()
  .regex(/^fb\.\d+\.\d+\.\S{1,500}$/)
  .optional()
  .catch(undefined);

/** Browser data sent with an order for the Meta Conversions API (all optional). */
export const metaTrackingSchema = z.object({
  fbp: metaCookieSchema,
  fbc: metaCookieSchema,
  /** Page where the order was placed. */
  eventSourceUrl: z.url().max(2000).optional().catch(undefined),
});
export type MetaTracking = z.infer<typeof metaTrackingSchema>;

/**
 * Time-to-fill check of the public forms: milliseconds between the form appearing and its
 * sending, measured by the browser. People need more than a few seconds; scripts post at once
 * or call the API directly (no value). Such sends are kept but flagged "suspect", never lost.
 */
export const FORM_TIMING_FIELD = "elapsedMs";
/** Forms sent faster than this are flagged as bots. */
export const MIN_FORM_FILL_MS = 2000;
const formTimingSchema = z.number().int().min(0).max(1e9).optional().catch(undefined);

/** French reason to flag a send by its fill time, or null when it looks human. */
export function formTimingReason(elapsedMs: number | undefined): string | null {
  if (elapsedMs === undefined)
    return "Envoyé sans passer par le formulaire du site (robot probable)";
  if (elapsedMs < MIN_FORM_FILL_MS) {
    return `Formulaire envoyé en ${(elapsedMs / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s (robot probable)`;
  }
  return null;
}

/** Body of POST /api/orders. */
export const orderRequestSchema = z.object({
  order: productOrderSchema,
  tracking: metaTrackingSchema.optional().catch(undefined),
  [HONEYPOT_FIELD]: honeypotSchema,
  [FORM_TIMING_FIELD]: formTimingSchema,
});
export type OrderRequest = z.input<typeof orderRequestSchema>;

/** Body of POST /api/contact-messages: the contact form plus the honeypot. */
export const contactRequestSchema = contactFormSchema.extend({
  [HONEYPOT_FIELD]: honeypotSchema,
  [FORM_TIMING_FIELD]: formTimingSchema,
});
export type ContactRequest = z.input<typeof contactRequestSchema>;

/** Body of POST /api/newsletter: the e-mail plus the honeypot and the fill time. */
export const newsletterRequestSchema = newsletterFormSchema.extend({
  [HONEYPOT_FIELD]: honeypotSchema,
  [FORM_TIMING_FIELD]: formTimingSchema,
});
export type NewsletterRequest = z.input<typeof newsletterRequestSchema>;

/** Body of POST /api/newsletter/confirm: the token of the confirmation link. */
export const newsletterConfirmSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Ce lien de confirmation n'est pas valable."),
});
export type NewsletterConfirm = z.infer<typeof newsletterConfirmSchema>;
/** Answer when the confirmation link is unknown, used or older than 7 days. */
export const INVALID_NEWSLETTER_LINK =
  "Ce lien de confirmation n'est plus valable. Inscrivez-vous à nouveau pour en recevoir un autre.";

/** Error body of every API error. `fields` maps a form field to its French message. */
export const apiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

/** Cache tags of the website pages that the API refreshes after a dashboard change. */
export const CACHE_TAGS = ["products", "delivery-fees"] as const;
export type CacheTag = (typeof CACHE_TAGS)[number];

/** Header carrying the revalidation secret (API → website). */
export const REVALIDATE_SECRET_HEADER = "x-revalidate-secret";

export const revalidateRequestSchema = z.object({
  tags: z.array(z.enum(CACHE_TAGS)).min(1).max(CACHE_TAGS.length),
});
