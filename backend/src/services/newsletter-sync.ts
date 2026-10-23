import { createHash, randomBytes } from "node:crypto";
import { INVALID_NEWSLETTER_LINK } from "@rassm/shared";
import type { Types } from "mongoose";
import type { ClientInfo } from "../lib/client-info";
import { HttpError } from "../lib/http-error";
import { describeError, logger } from "../lib/logger";
import {
  NewsletterSubscriberModel,
  type NewsletterSubscriberDoc,
} from "../models/newsletter-subscriber";
import { brevoRequest, sendEmail } from "../notifications/brevo";
import {
  NEWSLETTER_CONFIRM_DAYS,
  buildNewsletterConfirmEmail,
} from "../notifications/newsletter-confirm-email";

// Newsletter subscribers → the Brevo list BREVO_NEWSLETTER_LIST_ID, with double opt-in: a new
// subscriber receives a French confirmation e-mail (sent through Brevo) and is added to the list
// only after clicking its link. Newsletters are written and sent from Brevo; the site only keeps
// the list in sync. Every call runs in the background: a failure is logged and stored on the
// subscriber ("En erreur", "Réessayer").

export interface BrevoListConfig {
  apiKey: string;
  listId: number;
  /** Sender of the confirmation e-mail (validated in Brevo). */
  from: string;
}

/** The Brevo calls (mocked in the tests). */
export interface NewsletterList {
  configured: boolean;
  /** Adds the contact to the list (creates it, or updates it when it exists). */
  add(email: string): Promise<void>;
  /** Removes the contact from the list (the Brevo contact itself is kept). */
  remove(email: string): Promise<void>;
  /** Sends the confirmation e-mail (double opt-in) with its link. */
  sendConfirmation(email: string, link: string): Promise<void>;
}

export function createBrevoNewsletterList(config: BrevoListConfig | null): NewsletterList {
  if (!config) {
    const off = async () => {
      throw new Error("Brevo newsletter list not configured");
    };
    return { configured: false, add: off, remove: off, sendConfirmation: off };
  }
  return {
    configured: true,
    async sendConfirmation(email, link) {
      await sendEmail(
        { brevoApiKey: config.apiKey, from: config.from, notifyEmail: email, adminUrl: "" },
        email,
        buildNewsletterConfirmEmail(link),
      );
    },
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

/**
 * Adds one subscriber to the Brevo list and records the result. Never throws. A subscriber who
 * has not confirmed the address yet is never added (double opt-in).
 */
export async function syncSubscriber(list: NewsletterList, id: Types.ObjectId, email: string) {
  if (await NewsletterSubscriberModel.exists({ _id: id, confirmationPending: { $exists: true } })) {
    return "unconfirmed" as const;
  }
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

// ---------- Double opt-in ----------

const DAY_MS = 24 * 60 * 60 * 1000;
/** A new confirmation e-mail is sent at most once an hour to the same address. */
const RESEND_AFTER_MS = 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface ConfirmationOptions {
  /** The website (first FRONTEND_ORIGIN): the link opens its /newsletter/confirmation page. */
  siteUrl: string;
  /** Development without Brevo: write the link in the API logs to test the flow. */
  logLinks?: boolean;
}

/**
 * Sends a new confirmation e-mail (a new token: the previous link stops working). The link
 * carries the token after "#": it never reaches a server log. Never throws.
 */
export async function sendConfirmation(
  list: NewsletterList,
  subscriber: Pick<NewsletterSubscriberDoc, "_id" | "email">,
  options: ConfirmationOptions,
  now = new Date(),
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await NewsletterSubscriberModel.updateOne(
    { _id: subscriber._id },
    {
      $set: {
        confirmationPending: {
          tokenHash: hashToken(token),
          sentAt: now,
          expiresAt: new Date(now.getTime() + NEWSLETTER_CONFIRM_DAYS * DAY_MS),
        },
        brevo: { status: list.configured ? "unconfirmed" : "off", error: null, at: now },
      },
    },
  );
  const link = `${options.siteUrl}/newsletter/confirmation#jeton=${token}`;
  if (!list.configured) {
    if (options.logLinks) console.warn(`Newsletter confirmation link (development): ${link}`);
    return;
  }
  try {
    await list.sendConfirmation(subscriber.email, link);
  } catch (error) {
    logger.error("Newsletter confirmation e-mail failed", describeError(error));
    await NewsletterSubscriberModel.updateOne(
      { _id: subscriber._id },
      {
        $set: {
          brevo: {
            status: "failed",
            error: "L'e-mail de confirmation n'a pas pu être envoyé.",
            at: new Date(),
          },
        },
      },
    ).catch((dbError: unknown) =>
      logger.error("Could not record the confirmation e-mail status", describeError(dbError)),
    );
  }
}

/**
 * A newsletter sign-up. The answer never says whether the address was already there. A new
 * address gets the confirmation e-mail, except a sign-up sent too fast or without the form (kept,
 * "En erreur" with the reason; "Réessayer" in Abonnés sends the e-mail). An address that is not
 * confirmed yet gets a new e-mail at most once an hour.
 */
export async function subscribe(
  input: { email: string; client: ClientInfo; suspiciousReason: string | null },
  list: NewsletterList,
  options: ConfirmationOptions,
  now = new Date(),
): Promise<void> {
  const email = input.email.toLowerCase();
  const existing = await NewsletterSubscriberModel.findOne({
    email,
  }).lean<NewsletterSubscriberDoc>();
  if (existing) {
    const pending = existing.confirmationPending;
    const sentAt = pending?.sentAt?.getTime() ?? 0;
    if (pending && !existing.suspicious && now.getTime() - sentAt >= RESEND_AFTER_MS) {
      inBackground(sendConfirmation(list, existing, options, now), "Newsletter confirmation");
    }
    return;
  }
  const result = await NewsletterSubscriberModel.updateOne(
    { email },
    {
      $setOnInsert: {
        email,
        client: { ip: input.client.ip, userAgent: input.client.userAgent },
        suspicious: input.suspiciousReason !== null,
        suspiciousReason: input.suspiciousReason,
        confirmationPending: { tokenHash: null, sentAt: null, expiresAt: null },
        confirmedAt: null,
        brevo: !list.configured
          ? { status: "off" }
          : input.suspiciousReason
            ? {
                status: "failed",
                error: `Inscription suspecte : ${input.suspiciousReason} (aucun e-mail envoyé)`,
                at: now,
              }
            : { status: "unconfirmed" },
      },
    },
    { upsert: true },
  ).catch((error: unknown) => {
    // Two simultaneous sign-ups of the same email: the other one created it.
    if ((error as { code?: number }).code !== 11000) throw error;
    return null;
  });
  const id = result?.upsertedId;
  if (id && !input.suspiciousReason) {
    inBackground(
      sendConfirmation(list, { _id: id, email }, options, now),
      "Newsletter confirmation",
    );
  }
}

/** The link of the confirmation e-mail: confirms the address, then adds it to the Brevo list. */
export async function confirmSubscription(
  token: string,
  list: NewsletterList,
  now = new Date(),
): Promise<void> {
  const doc = await NewsletterSubscriberModel.findOneAndUpdate(
    {
      "confirmationPending.tokenHash": hashToken(token),
      "confirmationPending.expiresAt": { $gt: now },
    },
    {
      $unset: { confirmationPending: 1 },
      $set: {
        confirmedAt: now,
        brevo: { status: list.configured ? "pending" : "off", error: null, at: now },
      },
    },
    { returnDocument: "after" },
  ).lean<NewsletterSubscriberDoc>();
  if (!doc) throw new HttpError(400, INVALID_NEWSLETTER_LINK);
  logger.info("Newsletter subscription confirmed");
  if (list.configured) {
    inBackground(syncSubscriber(list, doc._id, doc.email), "Brevo newsletter sync");
  }
}
