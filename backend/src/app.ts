import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Revalidator } from "./lib/revalidate";
import type { MetaEvents } from "./meta/conversions-api";
import type { ImageStorage } from "./services/image-storage";
import type { MessageNotifier } from "./notifications/new-message-email";
import type { OrderNotifier } from "./notifications/new-order-email";
import type { SecurityMailer } from "./notifications/security-email";
import type { NewsletterList } from "./services/newsletter-sync";
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
  /** Login requests per IP (on top of the 5-failure lock per account and per IP). */
  login: { windowMs: FIFTEEN_MINUTES, limit: 20 },
  /** Requests per IP on each password route (forgot, reset, change). */
  password: { windowMs: FIFTEEN_MINUTES, limit: 10 },
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
  /** New contact message e-mail to the team. */
  messageNotifier: MessageNotifier;
  /** Brevo newsletter list (sign-ups added, deleted subscribers removed). */
  newsletterList: NewsletterList;
  /** Admin session cookie only over HTTPS (production). */
  secureCookies: boolean;
  /** Password reset links and security alerts to the admin. */
  securityMailer: SecurityMailer;
  /** Dashboard URL (reset links), e.g. https://rassm.dz/admin. */
  adminUrl: string;
  /** Refreshes the website's pages after a dashboard change. */
  revalidator: Revalidator;
  /** Product photos (Cloudinary); null = uploads disabled. */
  imageStorage: ImageStorage | null;
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
  // The dashboard sends whole products (many photo URLs); public forms stay small.
  app.use("/api/admin", express.json({ limit: "200kb" }));
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
      passwordLimiter: () => limitRequests(limits.password),
      mailer: options.securityMailer,
      adminUrl: options.adminUrl,
      adminLimiter: limitRequests(limits.admin),
      metaEvents: options.metaEvents,
      revalidator: options.revalidator,
      imageStorage: options.imageStorage,
      newsletterList: options.newsletterList,
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
      {
        metaEvents: options.metaEvents,
        notifier: options.notifier,
        messageNotifier: options.messageNotifier,
        newsletterList: options.newsletterList,
      },
    ),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
