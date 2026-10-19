import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { MetaEvents } from "./meta/conversions-api";
import type { OrderNotifier } from "./notifications/new-order-email";
import { errorHandler, notFound } from "./middleware/error-handler";
import { limitRequests, rejectUnsafeKeys, type RateLimitOptions } from "./middleware/security";
import { adminRouter } from "./routes/admin";
import { catalogRouter } from "./routes/catalog";
import { formsRouter } from "./routes/forms";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Default per-IP limits: generous for real customers, low enough to stop scripts. */
export const DEFAULT_RATE_LIMITS = {
  orders: { windowMs: FIFTEEN_MINUTES, limit: 10 },
  contact: { windowMs: FIFTEEN_MINUTES, limit: 5 },
  newsletter: { windowMs: FIFTEEN_MINUTES, limit: 10 },
  /** Login attempts per IP (the account itself locks after 5 failures in a row). */
  login: { windowMs: FIFTEEN_MINUTES, limit: 10 },
  /** Dashboard requests per IP (the live updates poll every few seconds). */
  admin: { windowMs: FIFTEEN_MINUTES, limit: 3000 },
} satisfies Record<string, RateLimitOptions>;

export interface AppOptions {
  /** Origins allowed by CORS (the website). */
  frontendOrigins: readonly string[];
  /** Number of reverse proxies in front of the API (see TRUST_PROXY). */
  trustProxy: number;
  metaEvents: MetaEvents;
  notifier: OrderNotifier;
  /** Admin session cookie only over HTTPS (production). */
  secureCookies: boolean;
  rateLimits?: Partial<typeof DEFAULT_RATE_LIMITS>;
}

const isLoopback = (address: string) =>
  address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";

export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  // X-Forwarded-For is read only from the configured proxies, and from the local Next.js
  // server, which forwards the dashboard requests (/api/admin) with the visitor's IP.
  app.set(
    "trust proxy",
    (address: string, hop: number) => hop < options.trustProxy || isLoopback(address),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: [...options.frontendOrigins],
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "20kb" }));
  app.use(rejectUnsafeKeys);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const limits = { ...DEFAULT_RATE_LIMITS, ...options.rateLimits };
  app.use(
    "/api/admin",
    adminRouter({
      allowedOrigins: options.frontendOrigins,
      secureCookies: options.secureCookies,
      loginLimiter: limitRequests(limits.login),
      adminLimiter: limitRequests(limits.admin),
      metaEvents: options.metaEvents,
    }),
  );
  app.use("/api", catalogRouter());
  app.use(
    "/api",
    formsRouter(
      {
        orders: limitRequests(limits.orders),
        contact: limitRequests(limits.contact),
        newsletter: limitRequests(limits.newsletter),
      },
      { metaEvents: options.metaEvents, notifier: options.notifier },
    ),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
