import { z } from "zod";
import { contactFormSchema } from "./forms";
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
  orderBlacklist: (id: string) => `/api/admin/orders/${encodeURIComponent(id)}/blacklist`,
  andersonExport: "/api/admin/orders/export",
  bulkShip: "/api/admin/orders/ship",
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

/** Name of the admin session cookie (httpOnly, set by the API). */
export const ADMIN_SESSION_COOKIE = "rassm_admin";
/** Long-lived random id of a browser (httpOnly): a login from an unknown one sends an alert. */
export const ADMIN_DEVICE_COOKIE = "rassm_device";

/**
 * Hidden anti-spam field ("honeypot") of the order and contact forms. People never see it
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

/** Body of POST /api/orders. */
export const orderRequestSchema = z.object({
  order: productOrderSchema,
  tracking: metaTrackingSchema.optional().catch(undefined),
  [HONEYPOT_FIELD]: honeypotSchema,
});
export type OrderRequest = z.input<typeof orderRequestSchema>;

/** Body of POST /api/contact-messages: the contact form plus the honeypot. */
export const contactRequestSchema = contactFormSchema.extend({
  [HONEYPOT_FIELD]: honeypotSchema,
});

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
