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
import { clientIpOf, dashboardClientIp } from "./lib/client-ip";
import { knownDevice } from "./middleware/admin";
import { limitRequests, rejectUnsafeKeys, type RateLimitOptions } from "./middleware/security";
import { adminRouter } from "./routes/admin";
import { catalogRouter } from "./routes/catalog";
import { formsRouter } from "./routes/forms";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Default per-IP limits: generous for real customers (many share one IP behind their mobile
 * operator), low enough to stop scripts. Kept in memory: one API instance (see SECURITY.md).
 */
export const DEFAULT_RATE_LIMITS = {
  /** Safety net on every route (scans of unknown URLs included). */
  global: { windowMs: FIFTEEN_MINUTES, limit: 5000 },
  /** Products and delivery fees (the website server caches them, browsers rarely call). */
  catalog: { windowMs: FIFTEEN_MINUTES, limit: 1200 },
  /**
   * Order requests per IP. Many mobile customers in Algeria share one IP (carrier-grade NAT), so
   * this only stops floods; fake orders are handled per IP over 24 hours (services/fraud.ts).
   */
  orders: { windowMs: FIFTEEN_MINUTES, limit: 30 },
  contact: { windowMs: FIFTEEN_MINUTES, limit: 5 },
  newsletter: { windowMs: FIFTEEN_MINUTES, limit: 10 },
  /** Login requests per IP (on top of the 5-failure lock per account and per IP). */
  login: { windowMs: FIFTEEN_MINUTES, limit: 20 },
  /**
   * Login requests from every IP together (each one costs 64 MiB of memory to check), except
   * from a browser an admin already logged in with: the admin is never locked out by it.
   */
  loginAll: { windowMs: FIFTEEN_MINUTES, limit: 100 },
  /** Requests per IP on each password route (forgot, reset, change). */
  password: { windowMs: FIFTEEN_MINUTES, limit: 10 },
  /** Dashboard requests per IP (the live updates poll every few seconds). */
  admin: { windowMs: FIFTEEN_MINUTES, limit: 3000 },
  /** Photo uploads and CSV exports of customer data, per route. */
  sensitive: { windowMs: FIFTEEN_MINUTES, limit: 60 },
} satisfies Record<string, RateLimitOptions>;

export interface AppOptions {
  /** Origins allowed by CORS (the website). The first one builds the e-mail links. */
  frontendOrigins: readonly string[];
  /** Origins allowed to use the dashboard API (ADMIN_ORIGIN; the website when not set). */
  adminOrigins?: readonly string[];
  /** Number of reverse proxies in front of the API (see TRUST_PROXY). */
  trustProxy: number;
  /** Checks the visitor IP signed by the website on dashboard requests (ADMIN_PROXY_SECRET). */
  adminProxySecret: string | null;
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
  /** Development without Brevo: newsletter confirmation links written in the API logs. */
  logNewsletterLinks?: boolean;
  rateLimits?: Partial<typeof DEFAULT_RATE_LIMITS>;
}

export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  // X-Forwarded-For is read only for the configured proxies of the host, never further, and
  // never trusted from the local machine as such. Dashboard requests use the IP signed by the
  // website instead (lib/client-ip.ts).
  app.set("trust proxy", options.trustProxy);

  // A JSON API: nothing may be rendered, framed or loaded from its answers.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
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
  const confirmation = {
    siteUrl: options.frontendOrigins[0] ?? "",
    logLinks: options.logNewsletterLinks ?? false,
  };
  app.use("/api/admin", dashboardClientIp(options.adminProxySecret));
  app.use(limitRequests(limits.global));
  // Setup check of TRUST_PROXY (docs/DEPLOYMENT.md): the IP the API sees for the caller, and the
  // X-Forwarded-For entries it received (the caller's own address and the host's proxies).
  app.get("/health/ip", (req, res) => {
    const forwardedFor = (req.get("x-forwarded-for") ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    res.set("Cache-Control", "no-store").json({ ip: clientIpOf(req), forwardedFor });
  });
  app.use(
    "/api/admin",
    adminRouter({
      allowedOrigins: options.adminOrigins?.length ? options.adminOrigins : options.frontendOrigins,
      secureCookies: options.secureCookies,
      loginLimiter: limitRequests(limits.login),
      loginLimiterAll: limitRequests(limits.loginAll, {
        per: "all",
        skip: knownDevice(options.secureCookies),
      }),
      passwordLimiter: () => limitRequests(limits.password),
      mailer: options.securityMailer,
      adminUrl: options.adminUrl,
      adminLimiter: limitRequests(limits.admin),
      sensitiveLimiter: () => limitRequests(limits.sensitive),
      metaEvents: options.metaEvents,
      revalidator: options.revalidator,
      imageStorage: options.imageStorage,
      newsletterList: options.newsletterList,
      confirmation,
    }),
  );
  app.use("/api", catalogRouter(limitRequests(limits.catalog)));
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
        confirmation,
      },
    ),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
