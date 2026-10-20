import type { Types } from "mongoose";
import { describeError, logger } from "../lib/logger";
import { NewsletterSubscriberModel } from "../models/newsletter-subscriber";
import { brevoRequest } from "../notifications/brevo";

// Newsletter subscribers → the Brevo list BREVO_NEWSLETTER_LIST_ID. Newsletters are written
// and sent from Brevo; the site only keeps the list in sync. Every call runs in the
// background: a failure is logged and stored on the subscriber ("En erreur", "Réessayer").

export interface BrevoListConfig {
  apiKey: string;
  listId: number;
}

/** The Brevo calls (mocked in the tests). */
export interface NewsletterList {
  configured: boolean;
  /** Adds the contact to the list (creates it, or updates it when it exists). */
  add(email: string): Promise<void>;
  /** Removes the contact from the list (the Brevo contact itself is kept). */
  remove(email: string): Promise<void>;
}

export function createBrevoNewsletterList(config: BrevoListConfig | null): NewsletterList {
  if (!config) {
    const off = async () => {
      throw new Error("Brevo newsletter list not configured");
    };
    return { configured: false, add: off, remove: off };
  }
  return {
    configured: true,
    async add(email) {
      await brevoRequest(config.apiKey, "/contacts", {
        method: "POST",
        body: { email, listIds: [config.listId], updateEnabled: true },
      });
    },
    async remove(email) {
      try {
        await brevoRequest(config.apiKey, `/contacts/lists/${config.listId}/contacts/remove`, {
          method: "POST",
          body: { emails: [email] },
        });
      } catch (error) {
        // Not in the list (or no such contact): nothing to remove.
        if (/Brevo answered (400|404)/.test(String((error as Error).message))) return;
        throw error;
      }
    },
  };
}

/** Short French reason shown in the dashboard. */
function failureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/401|unauthori[sz]ed|key/i.test(message)) return "Clé Brevo refusée.";
  if (/404/.test(message)) return "Liste Brevo introuvable (vérifiez BREVO_NEWSLETTER_LIST_ID).";
  if (/timeout|abort|fetch failed|network/i.test(message)) return "Brevo injoignable.";
  return "Brevo a refusé ce contact.";
}

/** Adds one subscriber to the Brevo list and records the result. Never throws. */
export async function syncSubscriber(list: NewsletterList, id: Types.ObjectId, email: string) {
  if (!list.configured) {
    await NewsletterSubscriberModel.updateOne(
      { _id: id },
      { $set: { brevo: { status: "off", error: null, at: null } } },
    );
    return "off" as const;
  }
  try {
    await list.add(email);
    await NewsletterSubscriberModel.updateOne(
      { _id: id },
      { $set: { brevo: { status: "synced", error: null, at: new Date() } } },
    );
    return "synced" as const;
  } catch (error) {
    logger.error("Newsletter contact not added to Brevo", describeError(error));
    await NewsletterSubscriberModel.updateOne(
      { _id: id },
      { $set: { brevo: { status: "failed", error: failureReason(error), at: new Date() } } },
    ).catch((dbError: unknown) =>
      logger.error("Could not record the Brevo sync status", describeError(dbError)),
    );
    return "failed" as const;
  }
}

/** Background task: logged when it fails, never awaited by the request. */
export function inBackground(task: Promise<unknown>, what: string) {
  void task.catch((error: unknown) => logger.error(`${what} crashed`, describeError(error)));
}
