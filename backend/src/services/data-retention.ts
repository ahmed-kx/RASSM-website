import { describeError, logger } from "../lib/logger";
import { ContactMessageModel } from "../models/contact-message";
import { NewsletterSubscriberModel } from "../models/newsletter-subscriber";
import { OrderModel } from "../models/order";

// Data retention (privacy page, /confidentialite): the IP address and the browser (user agent)
// kept with orders, contact messages and newsletter sign-ups are deleted 12 months after them.
// The API runs this at startup and once a day; `pnpm purge-client-data` runs it by hand.

/** IP addresses and browsers are kept this long (12 months). */
export const CLIENT_DATA_RETENTION_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PurgeResult {
  orders: number;
  messages: number;
  subscribers: number;
}

export async function purgeOldClientData(now = new Date()): Promise<PurgeResult> {
  const before = new Date(now.getTime() - CLIENT_DATA_RETENTION_DAYS * DAY_MS);
  // Only documents that still hold one of them (cheap to re-run).
  const filter = {
    createdAt: { $lt: before },
    $or: [{ "client.ip": { $ne: null } }, { "client.userAgent": { $ne: null } }],
  };
  const update = { $set: { "client.ip": null, "client.userAgent": null } };
  const [orders, messages, subscribers] = await Promise.all([
    OrderModel.updateMany(filter, update),
    ContactMessageModel.updateMany(filter, update),
    NewsletterSubscriberModel.updateMany(filter, update),
  ]);
  return {
    orders: orders.modifiedCount,
    messages: messages.modifiedCount,
    subscribers: subscribers.modifiedCount,
  };
}

/** Runs the purge now and every 24 hours (the timer never keeps the process alive). */
export function schedulePurge(): NodeJS.Timeout {
  const run = () => {
    purgeOldClientData()
      .then((result) => {
        if (result.orders || result.messages || result.subscribers) {
          logger.info("Old IP addresses and browsers deleted", { ...result });
        }
      })
      .catch((error: unknown) =>
        logger.error("Could not delete old IP addresses", describeError(error)),
      );
  };
  run();
  const timer = setInterval(run, DAY_MS);
  timer.unref();
  return timer;
}
