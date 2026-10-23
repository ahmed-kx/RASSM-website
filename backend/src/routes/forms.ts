import {
  contactRequestSchema,
  formTimingReason,
  newsletterConfirmSchema,
  newsletterRequestSchema,
} from "@rassm/shared";
import { Router, type RequestHandler } from "express";
import { getClientInfo } from "../lib/client-info";
import { clientIpOf } from "../lib/client-ip";
import { parseOrThrow } from "../lib/http-error";
import { logger } from "../lib/logger";
import type { MetaEvents } from "../meta/conversions-api";
import type { MessageNotifier } from "../notifications/new-message-email";
import type { OrderNotifier } from "../notifications/new-order-email";
import { ContactMessageModel } from "../models/contact-message";
import {
  confirmSubscription,
  inBackground,
  subscribe,
  type ConfirmationOptions,
  type NewsletterList,
} from "../services/newsletter-sync";
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
    /** Links of the newsletter confirmation e-mail. */
    confirmation: ConfirmationOptions;
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
    const { website, elapsedMs, ...message } = parseOrThrow(contactRequestSchema, req.body);
    // Honeypot filled: a bot. Pretend it worked and save nothing.
    if (website?.trim()) {
      logger.warn("Contact honeypot filled: ignored", { ip: clientIpOf(req) });
    } else {
      // Sent too fast or without the form: kept, flagged "Suspect" in the dashboard.
      const suspiciousReason = formTimingReason(elapsedMs);
      const doc = await ContactMessageModel.create({
        ...message,
        suspicious: suspiciousReason !== null,
        suspiciousReason,
        client: getClientInfo(req),
      });
      // Background: the e-mail to the team never slows down or fails the message.
      inBackground(services.messageNotifier.notifyNewMessage(doc.toObject()), "New message e-mail");
    }
    res.status(201).json({ ok: true });
  });

  router.post("/newsletter", limiters.newsletter, async (req, res) => {
    const { email, website, elapsedMs } = parseOrThrow(newsletterRequestSchema, req.body);
    // Honeypot filled: a bot. Pretend it worked and save nothing.
    if (website?.trim()) {
      logger.warn("Newsletter honeypot filled: ignored", { ip: clientIpOf(req) });
      res.status(201).json({ ok: true });
      return;
    }
    // Double opt-in: a confirmation e-mail, and the Brevo list only once the link is clicked.
    // Signing up twice keeps one entry, and the answer is the same (no way to probe emails).
    await subscribe(
      { email, client: getClientInfo(req), suspiciousReason: formTimingReason(elapsedMs) },
      services.newsletterList,
      services.confirmation,
    );
    res.status(201).json({ ok: true });
  });

  router.post("/newsletter/confirm", limiters.newsletter, async (req, res) => {
    const { token } = parseOrThrow(newsletterConfirmSchema, req.body);
    await confirmSubscription(token, services.newsletterList);
    res.json({ ok: true });
  });

  return router;
}
