import {
  adminSubscriberSchema,
  type AdminSubscriber,
  type AdminSubscriberList,
  type adminSubscriberQuerySchema,
} from "@rassm/shared";
import { Types, type QueryFilter } from "mongoose";
import type { z } from "zod";
import { buildCsv } from "../lib/csv";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";
import {
  NewsletterSubscriberModel,
  type NewsletterSubscriberDoc,
} from "../models/newsletter-subscriber";
import {
  inBackground,
  sendConfirmation,
  syncSubscriber,
  type ConfirmationOptions,
  type NewsletterList,
} from "./newsletter-sync";

// Abonnés: newsletter subscribers, kept in sync with the Brevo list.

type SubscriberQuery = z.output<typeof adminSubscriberQuerySchema>;

const NOT_FOUND = "Abonné introuvable.";
const NOT_CONFIGURED =
  "La synchronisation Brevo n'est pas configurée (BREVO_API_KEY ou BREVO_NEWSLETTER_LIST_ID manquant dans backend/.env).";
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, NOT_FOUND);
  return new Types.ObjectId(id);
}

function toAdminSubscriber(doc: NewsletterSubscriberDoc, configured: boolean): AdminSubscriber {
  // Never tried yet (sign-ups before step 3D): "pending"; "off" while Brevo is not set up.
  const status = doc.brevo?.status ?? "pending";
  return adminSubscriberSchema.parse({
    id: doc._id.toString(),
    email: doc.email,
    createdAt: doc.createdAt.toISOString(),
    sync: {
      status: !configured && status !== "synced" ? "off" : status,
      error: doc.brevo?.error ?? null,
      at: doc.brevo?.at ? doc.brevo.at.toISOString() : null,
    },
  });
}

function filterOf(
  query: Pick<SubscriberQuery, "q" | "sync">,
): QueryFilter<NewsletterSubscriberDoc> {
  const q = query.q?.trim();
  return {
    ...(q && { email: { $regex: escapeRegex(q), $options: "i" } }),
    ...(query.sync === "pending"
      ? { $or: [{ "brevo.status": "pending" }, { "brevo.status": { $exists: false } }] }
      : query.sync !== "all" && { "brevo.status": query.sync }),
  };
}

export async function listSubscribers(
  query: SubscriberQuery,
  list: NewsletterList,
): Promise<AdminSubscriberList> {
  const filter = filterOf(query);
  const [docs, total] = await Promise.all([
    NewsletterSubscriberModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<NewsletterSubscriberDoc[]>(),
    NewsletterSubscriberModel.countDocuments(filter),
  ]);
  return {
    subscribers: docs.map((doc) => toAdminSubscriber(doc, list.configured)),
    total,
    brevoConfigured: list.configured,
  };
}

export async function subscribersCsv(query: SubscriberQuery): Promise<string> {
  const docs = await NewsletterSubscriberModel.find(filterOf(query))
    .sort({ createdAt: -1 })
    .lean<NewsletterSubscriberDoc[]>();
  return buildCsv(
    ["E-mail", "Inscription", "Adresse confirmée"],
    docs.map((doc) => [
      doc.email,
      new Date(doc.createdAt.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10),
      doc.confirmationPending ? "Non" : "Oui",
    ]),
  );
}

/** Deletes the subscriber and removes it from the Brevo list in the background. */
export async function deleteSubscriber(id: string, list: NewsletterList) {
  const doc = await NewsletterSubscriberModel.findByIdAndDelete(
    parseId(id),
  ).lean<NewsletterSubscriberDoc>();
  if (!doc) throw new HttpError(404, NOT_FOUND);
  logger.info("Newsletter subscriber deleted");
  if (list.configured) inBackground(list.remove(doc.email), "Brevo contact removal");
}

/**
 * "Réessayer": adds a confirmed subscriber to the Brevo list again, or sends a new confirmation
 * e-mail to one who has not confirmed (never added before the link is clicked). Waits for the
 * answer.
 */
export async function retrySubscriberSync(
  id: string,
  list: NewsletterList,
  confirmation: ConfirmationOptions,
) {
  const doc = await NewsletterSubscriberModel.findById(parseId(id)).lean<NewsletterSubscriberDoc>();
  if (!doc) throw new HttpError(404, NOT_FOUND);
  if (!list.configured) throw new HttpError(503, NOT_CONFIGURED);
  if (doc.confirmationPending) await sendConfirmation(list, doc, confirmation);
  else await syncSubscriber(list, doc._id, doc.email);
  const updated = await NewsletterSubscriberModel.findById(doc._id).lean<NewsletterSubscriberDoc>();
  return toAdminSubscriber(updated ?? doc, list.configured);
}
