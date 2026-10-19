// pnpm seed            → creates missing products, updates the delivery fees
// pnpm seed -- --reset → also overwrites existing products (stock included) with the mocks
import { connectDatabase, disconnectDatabase } from "./db";
import { loadEnv } from "./env";
import { describeError, logger } from "./lib/logger";
import { ContactMessageModel } from "./models/contact-message";
import { CounterModel } from "./models/counter";
import { NewsletterSubscriberModel } from "./models/newsletter-subscriber";
import { OrderModel } from "./models/order";
import { seedDatabase } from "./seed";

const env = loadEnv();
const reset = process.argv.includes("--reset");

try {
  await connectDatabase(env.MONGODB_URI, env.MONGODB_DB_NAME, {
    dnsFallbackServers: env.DNS_FALLBACK_SERVERS,
  });
  const result = await seedDatabase({ reset });
  // Create the indexes of the other collections too, so the database is ready.
  await Promise.all(
    [OrderModel, ContactMessageModel, NewsletterSubscriberModel, CounterModel].map((model) =>
      model.syncIndexes(),
    ),
  );
  logger.info(`Seed done (database "${env.MONGODB_DB_NAME}")`, { ...result });
} catch (error) {
  logger.error("Seed failed", describeError(error));
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
