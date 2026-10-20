import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./db";
import { createRevalidator } from "./lib/revalidate";
import { ensureProductSkus } from "./models/product";
import { createCloudinaryStorage } from "./services/image-storage";
import { loadEnv } from "./env";
import { describeError, logger } from "./lib/logger";
import { createMetaEvents } from "./meta/conversions-api";
import { createMessageNotifier } from "./notifications/new-message-email";
import { createOrderNotifier } from "./notifications/new-order-email";
import { createSecurityMailer } from "./notifications/security-email";
import { createBrevoNewsletterList } from "./services/newsletter-sync";

const env = loadEnv();

const metaConfig =
  env.META_PIXEL_ID && env.META_CAPI_ACCESS_TOKEN
    ? {
        pixelId: env.META_PIXEL_ID,
        accessToken: env.META_CAPI_ACCESS_TOKEN,
        apiVersion: env.META_GRAPH_API_VERSION,
        testEventCode: env.META_TEST_EVENT_CODE,
      }
    : null;

try {
  await connectDatabase(env.MONGODB_URI, env.MONGODB_DB_NAME, {
    dnsFallbackServers: env.DNS_FALLBACK_SERVERS,
  });
} catch (error) {
  logger.error(
    "Could not connect to MongoDB (check MONGODB_URI, the Atlas network access list, and the DNS or VPN of this computer)",
    describeError(error),
  );
  process.exit(1);
}

// Products created before SKUs existed get one (safe to re-run).
const skusAdded = await ensureProductSkus();
if (skusAdded > 0) logger.info("SKUs given to existing products", { count: skusAdded });

const imageStorage =
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
    ? createCloudinaryStorage({
        cloudName: env.CLOUDINARY_CLOUD_NAME,
        apiKey: env.CLOUDINARY_API_KEY,
        apiSecret: env.CLOUDINARY_API_SECRET,
        folder: env.CLOUDINARY_FOLDER,
      })
    : null;
const revalidateUrl = env.REVALIDATE_URL ?? `${env.FRONTEND_ORIGIN[0]}/api/revalidate`;

const emailConfig = env.BREVO_API_KEY
  ? {
      brevoApiKey: env.BREVO_API_KEY,
      notifyEmail: env.NOTIFY_EMAIL,
      from: env.EMAIL_FROM,
      adminUrl: env.ADMIN_URL,
    }
  : null;
const newsletterList = createBrevoNewsletterList(
  env.BREVO_API_KEY && env.BREVO_NEWSLETTER_LIST_ID
    ? { apiKey: env.BREVO_API_KEY, listId: env.BREVO_NEWSLETTER_LIST_ID }
    : null,
);

const app = createApp({
  frontendOrigins: env.FRONTEND_ORIGIN,
  trustProxy: env.TRUST_PROXY,
  metaEvents: createMetaEvents(metaConfig),
  notifier: createOrderNotifier(emailConfig),
  messageNotifier: createMessageNotifier(emailConfig),
  newsletterList,
  secureCookies: env.NODE_ENV === "production",
  securityMailer: createSecurityMailer(emailConfig, {
    logResetLinks: env.NODE_ENV !== "production",
  }),
  adminUrl: env.ADMIN_URL,
  revalidator: createRevalidator(
    env.REVALIDATE_SECRET ? { url: revalidateUrl, secret: env.REVALIDATE_SECRET } : null,
  ),
  imageStorage,
});

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`, {
    allowedOrigins: env.FRONTEND_ORIGIN,
    metaConversionsApi: metaConfig ? "on" : "off (META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set)",
    productPhotos: imageStorage
      ? `on (Cloudinary, ${env.CLOUDINARY_FOLDER})`
      : "off (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET not set)",
    websiteRefresh: env.REVALIDATE_SECRET
      ? `on (${revalidateUrl})`
      : "off (REVALIDATE_SECRET not set)",
    teamEmails: env.BREVO_API_KEY
      ? `on (new orders and messages to ${env.NOTIFY_EMAIL}, security e-mails to the admin)`
      : "off (BREVO_API_KEY not set)",
    newsletterSync: newsletterList.configured
      ? `on (Brevo list ${env.BREVO_NEWSLETTER_LIST_ID})`
      : "off (BREVO_API_KEY or BREVO_NEWSLETTER_LIST_ID not set)",
  });
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    void disconnectDatabase().finally(() => process.exit(0));
  });
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
