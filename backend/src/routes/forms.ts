import { contactRequestSchema, newsletterFormSchema } from "@rassm/shared";
import { Router, type RequestHandler } from "express";
import { getClientInfo } from "../lib/client-info";
import { parseOrThrow } from "../lib/http-error";
import { logger } from "../lib/logger";
import type { MetaEvents } from "../meta/conversions-api";
import type { OrderNotifier } from "../notifications/new-order-email";
import { ContactMessageModel } from "../models/contact-message";
import { NewsletterSubscriberModel } from "../models/newsletter-subscriber";
import { placeOrder } from "../services/orders";

export interface FormLimiters {
  orders: RequestHandler;
  contact: RequestHandler;
  newsletter: RequestHandler;
}

/** Orders, contact messages and newsletter sign-ups (rate limited per IP). */
export function formsRouter(
  limiters: FormLimiters,
  services: { metaEvents: MetaEvents; notifier: OrderNotifier },
): Router {
  const router = Router();

  router.post("/orders", limiters.orders, async (req, res) => {
    const placed = await placeOrder(req.body, { client: getClientInfo(req), ...services });
    res.status(201).json(placed);
  });

  router.post("/contact-messages", limiters.contact, async (req, res) => {
    const { website, ...message } = parseOrThrow(contactRequestSchema, req.body);
    // Honeypot filled: a bot. Pretend it worked and save nothing.
    if (website?.trim()) {
      logger.warn("Contact honeypot filled: ignored", { ip: req.ip });
    } else {
      await ContactMessageModel.create({ ...message, client: getClientInfo(req) });
    }
    res.status(201).json({ ok: true });
  });

  router.post("/newsletter", limiters.newsletter, async (req, res) => {
    const { email } = parseOrThrow(newsletterFormSchema, req.body);
    // Signing up twice keeps one entry, and the answer is the same (no way to probe emails).
    await NewsletterSubscriberModel.updateOne(
      { email: email.toLowerCase() },
      { $setOnInsert: { email: email.toLowerCase(), client: getClientInfo(req) } },
      { upsert: true },
    ).catch((error: unknown) => {
      // Two simultaneous sign-ups of the same email: the other one created it.
      if ((error as { code?: number }).code !== 11000) throw error;
    });
    res.status(201).json({ ok: true });
  });

  return router;
}
