// pnpm purge-client-data: deletes the IP addresses and browsers (user agents) kept with orders,
// contact messages and newsletter sign-ups older than 12 months. The API already does it at
// startup and once a day; this runs it by hand or from a scheduler. Safe to re-run.
import { connectDatabase, disconnectDatabase } from "./db";
import { loadEnv } from "./env";
import { describeError, logger } from "./lib/logger";
import { CLIENT_DATA_RETENTION_DAYS, purgeOldClientData } from "./services/data-retention";

const env = loadEnv();

try {
  await connectDatabase(env.MONGODB_URI, env.MONGODB_DB_NAME, {
    dnsFallbackServers: env.DNS_FALLBACK_SERVERS,
  });
  const result = await purgeOldClientData();
  logger.info(`IP addresses and browsers older than ${CLIENT_DATA_RETENTION_DAYS} days deleted`, {
    ...result,
  });
} catch (error) {
  logger.error("Purge failed", describeError(error));
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
