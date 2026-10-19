import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./db";
import { loadEnv } from "./env";
import { describeError, logger } from "./lib/logger";
import { createMetaEvents } from "./meta/conversions-api";
import { createOrderNotifier } from "./notifications/new-order-email";

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
  await connectDatabase(env.MONGODB_URI, env.MONGODB_DB_NAME);
} catch (error) {
  logger.error(
    "Could not connect to MongoDB (check MONGODB_URI and the Atlas network access list)",
    describeError(error),
  );
  process.exit(1);
}

const app = createApp({
  frontendOrigins: env.FRONTEND_ORIGIN,
  trustProxy: env.TRUST_PROXY,
  metaEvents: createMetaEvents(metaConfig),
  notifier: createOrderNotifier(
    env.BREVO_API_KEY
      ? {
          brevoApiKey: env.BREVO_API_KEY,
          notifyEmail: env.NOTIFY_EMAIL,
          from: env.EMAIL_FROM,
          adminUrl: env.ADMIN_URL,
        }
      : null,
  ),
  secureCookies: env.NODE_ENV === "production",
});

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`, {
    allowedOrigins: env.FRONTEND_ORIGIN,
    metaConversionsApi: metaConfig ? "on" : "off (META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set)",
    newOrderEmails: env.BREVO_API_KEY
      ? `on (to ${env.NOTIFY_EMAIL})`
      : "off (BREVO_API_KEY not set)",
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
