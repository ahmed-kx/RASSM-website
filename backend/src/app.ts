import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { MetaEvents } from "./meta/conversions-api";
import { errorHandler, notFound } from "./middleware/error-handler";
import { limitRequests, rejectUnsafeKeys, type RateLimitOptions } from "./middleware/security";
import { catalogRouter } from "./routes/catalog";
import { formsRouter } from "./routes/forms";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Default per-IP limits: generous for real customers, low enough to stop scripts. */
export const DEFAULT_RATE_LIMITS = {
  orders: { windowMs: FIFTEEN_MINUTES, limit: 10 },
  contact: { windowMs: FIFTEEN_MINUTES, limit: 5 },
  newsletter: { windowMs: FIFTEEN_MINUTES, limit: 10 },
} satisfies Record<string, RateLimitOptions>;

export interface AppOptions {
  /** Origins allowed by CORS (the website). */
  frontendOrigins: readonly string[];
  /** Number of reverse proxies in front of the API (see TRUST_PROXY). */
  trustProxy: number;
  metaEvents: MetaEvents;
  rateLimits?: Partial<typeof DEFAULT_RATE_LIMITS>;
}

export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", options.trustProxy);

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
  app.use("/api", catalogRouter());
  app.use(
    "/api",
    formsRouter(
      {
        orders: limitRequests(limits.orders),
        contact: limitRequests(limits.contact),
        newsletter: limitRequests(limits.newsletter),
      },
      options.metaEvents,
    ),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
