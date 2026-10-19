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
} as const;

/** Name of the admin session cookie (httpOnly, set by the API). */
export const ADMIN_SESSION_COOKIE = "rassm_admin";

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
