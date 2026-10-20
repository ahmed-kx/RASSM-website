import { contactRequestSchema, newsletterFormSchema } from "@rassm/shared";
import { Router, type RequestHandler } from "express";
import { getClientInfo } from "../lib/client-info";
import { parseOrThrow } from "../lib/http-error";
import { logger } from "../lib/logger";
import type { MetaEvents } from "../meta/conversions-api";
import type { MessageNotifier } from "../notifications/new-message-email";
import type { OrderNotifier } from "../notifications/new-order-email";
import { ContactMessageModel } from "../models/contact-message";
import { NewsletterSubscriberModel } from "../models/newsletter-subscriber";
import { inBackground, syncSubscriber, type NewsletterList } from "../services/newsletter-sync";
import { placeOrder } from "../services/orders";

export interface FormLimiters {
  orders: RequestHandler;
  contact: RequestHandler;
  newsletter: RequestHandler;
}

/** Orders, contact messages and newsletter sign-ups (rate limited per IP). */
export function formsRouter(
  limiters: FormLimiters,
  services: {
    metaEvents: MetaEvents;
    notifier: OrderNotifier;
    messageNotifier: MessageNotifier;
    newsletterList: NewsletterList;
  },
): Router {
  const router = Router();

  router.post("/orders", limiters.orders, async (req, res) => {
    const placed = await placeOrder(req.body, {
      client: getClientInfo(req),
      metaEvents: services.metaEvents,
      notifier: services.notifier,
    });
    res.status(201).json(placed);
  });

  router.post("/contact-messages", limiters.contact, async (req, res) => {
    const { website, ...message } = parseOrThrow(contactRequestSchema, req.body);
    // Honeypot filled: a bot. Pretend it worked and save nothing.
    if (website?.trim()) {
      logger.warn("Contact honeypot filled: ignored", { ip: req.ip });
    } else {
      const doc = await ContactMessageModel.create({ ...message, client: getClientInfo(req) });
      // Background: the e-mail to the team never slows down or fails the message.
      inBackground(services.messageNotifier.notifyNewMessage(doc.toObject()), "New message e-mail");
    }
    res.status(201).json({ ok: true });
  });

  router.post("/newsletter", limiters.newsletter, async (req, res) => {
    const { email } = parseOrThrow(newsletterFormSchema, req.body);
    // Signing up twice keeps one entry, and the answer is the same (no way to probe emails).
    const address = email.toLowerCase();
    const result = await NewsletterSubscriberModel.updateOne(
      { email: address },
      {
        $setOnInsert: {
          email: address,
          client: getClientInfo(req),
          brevo: { status: services.newsletterList.configured ? "pending" : "off" },
        },
      },
      { upsert: true },
    ).catch((error: unknown) => {
      // Two simultaneous sign-ups of the same email: the other one created it.
      if ((error as { code?: number }).code !== 11000) throw error;
      return null;
    });
    // New subscriber: added to the Brevo list in the background (never blocks the sign-up).
    const id = result?.upsertedId;
    if (id && services.newsletterList.configured) {
      inBackground(syncSubscriber(services.newsletterList, id, address), "Brevo newsletter sync");
    }
    res.status(201).json({ ok: true });
  });

  return router;
}
