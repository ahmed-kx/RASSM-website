// pnpm sync-newsletter: adds the confirmed newsletter subscribers not yet in the Brevo list
// (BREVO_NEWSLETTER_LIST_ID). Safe to re-run: Brevo updates a contact that already exists, and
// subscribers already synchronised are skipped (`--all` sends every confirmed subscriber again).
// Addresses not confirmed yet (double opt-in) are never sent.

import { connectDatabase, disconnectDatabase } from "./db";
import { loadEnv } from "./env";
import {
  CONFIRMED_SUBSCRIBERS,
  NewsletterSubscriberModel,
  type NewsletterSubscriberDoc,
} from "./models/newsletter-subscriber";
import { createBrevoNewsletterList, syncSubscriber } from "./services/newsletter-sync";

/** Progress lines in the terminal. */
const say = (text: string) => process.stdout.write(`${text}\n`);

const env = loadEnv();
if (!env.BREVO_API_KEY || !env.BREVO_NEWSLETTER_LIST_ID) {
  console.error("Set BREVO_API_KEY and BREVO_NEWSLETTER_LIST_ID in backend/.env first.");
  process.exit(1);
}
const list = createBrevoNewsletterList({
  apiKey: env.BREVO_API_KEY,
  listId: env.BREVO_NEWSLETTER_LIST_ID,
  from: env.EMAIL_FROM ?? "",
});
const all = process.argv.includes("--all");

try {
  await connectDatabase(env.MONGODB_URI, env.MONGODB_DB_NAME, {
    dnsFallbackServers: env.DNS_FALLBACK_SERVERS,
  });
  // Confirmed addresses only (double opt-in): the others wait for their confirmation link.
  const subscribers = await NewsletterSubscriberModel.find({
    ...CONFIRMED_SUBSCRIBERS,
    ...(all ? {} : { "brevo.status": { $ne: "synced" } }),
  })
    .sort({ createdAt: 1 })
    .lean<NewsletterSubscriberDoc[]>();
  const results = { synced: 0, failed: 0 };
  for (const subscriber of subscribers) {
    const status = await syncSubscriber(list, subscriber._id, subscriber.email);
    if (status === "synced") results.synced += 1;
    else results.failed += 1;
  }
  say(
    subscribers.length === 0
      ? "Nothing to sync: every subscriber is already in the Brevo list."
      : `${results.synced} subscriber(s) added to the Brevo list ${env.BREVO_NEWSLETTER_LIST_ID}, ${results.failed} failed (see the dashboard, "Abonnés").`,
  );
  if (results.failed > 0) process.exitCode = 1;
} catch (error) {
  console.error("Sync stopped:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => undefined);
}
