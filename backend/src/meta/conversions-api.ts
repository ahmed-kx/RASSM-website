import { createHash } from "node:crypto";
import { getWilaya } from "@rassm/shared";
import { describeError, logger } from "../lib/logger";
import { OrderModel, type MetaEventStatus, type OrderDoc } from "../models/order";

// Meta Conversions API: server-side events, deduplicated with the browser Pixel through
// the same event_id (the internal order id). Sent in the background: a Meta failure is
// logged and never blocks or fails an order.

export interface MetaConfig {
  pixelId: string;
  accessToken: string;
  apiVersion: string;
  /** Events Manager "Test events" code (optional). */
  testEventCode?: string;
}

/** Prices are in Algerian dinars (same as the browser Pixel). */
export const META_CURRENCY = "DZD";

type MetaOrder = Pick<
  OrderDoc,
  | "_id"
  | "fullName"
  | "phone"
  | "wilayaCode"
  | "item"
  | "total"
  | "client"
  | "tracking"
  | "createdAt"
>;

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** "0555 12 34 56" → "213555123456": digits with the country code, no leading 0. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("213")) return digits;
  return `213${digits.replace(/^0/, "")}`;
}

/** Lowercase, no punctuation (Meta keeps UTF-8 letters such as é). */
function normalizeName(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** City: lowercase a-z only, no spaces or punctuation ("Béjaïa" → "bejaia"). */
function normalizeCity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** "Yacine Ben Ali" → first "yacine", last "ben ali". */
export function splitFullName(fullName: string): { firstName: string; lastName?: string } {
  const [first = "", ...rest] = normalizeName(fullName).split(" ");
  return { firstName: first, ...(rest.length ? { lastName: rest.join(" ") } : {}) };
}

/** Customer data in Meta's format: identifiers hashed with SHA-256, technical data as is. */
export function buildUserData(order: MetaOrder): Record<string, unknown> {
  const { firstName, lastName } = splitFullName(order.fullName);
  const wilaya = getWilaya(order.wilayaCode);
  return {
    ph: [sha256(normalizePhone(order.phone))],
    ...(firstName && { fn: [sha256(firstName)] }),
    ...(lastName && { ln: [sha256(lastName)] }),
    ...(wilaya && { ct: [sha256(normalizeCity(wilaya.name))] }),
    country: [sha256("dz")],
    ...(order.client.ip && { client_ip_address: order.client.ip }),
    ...(order.client.userAgent && { client_user_agent: order.client.userAgent }),
    ...(order.tracking?.fbp && { fbp: order.tracking?.fbp }),
    ...(order.tracking?.fbc && { fbc: order.tracking?.fbc }),
  };
}

function customData(order: MetaOrder) {
  return {
    value: order.total,
    currency: META_CURRENCY,
    content_ids: [order.item.productId],
    content_type: "product",
    contents: [{ id: order.item.productId, quantity: order.item.quantity }],
    num_items: order.item.quantity,
  };
}

export interface MetaEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "website" | "phone_call" | "system_generated";
  event_source_url?: string;
  user_data: Record<string, unknown>;
  custom_data: Record<string, unknown>;
}

/** The Purchase event of a new order: same event_id as the browser Pixel (the order id). */
export function buildPurchaseEvent(order: MetaOrder): MetaEvent {
  return {
    event_name: "Purchase",
    event_time: Math.floor(order.createdAt.getTime() / 1000),
    event_id: order._id.toString(),
    action_source: "website",
    ...(order.tracking?.eventSourceUrl && { event_source_url: order.tracking?.eventSourceUrl }),
    user_data: buildUserData(order),
    custom_data: customData(order),
  };
}

/**
 * Event for an order confirmed by phone (sent from the admin dashboard, later step), so
 * campaigns can optimise on confirmed orders. Custom event "CommandeConfirmee".
 */
export function buildOrderConfirmedEvent(order: MetaOrder, confirmedAt = new Date()): MetaEvent {
  return {
    event_name: "CommandeConfirmee",
    event_time: Math.floor(confirmedAt.getTime() / 1000),
    event_id: `${order._id.toString()}:confirmed`,
    action_source: "phone_call",
    user_data: buildUserData(order),
    custom_data: customData(order),
  };
}

/** POSTs events to the Graph API. Throws on a network error or a non-2xx answer. */
export async function postMetaEvents(config: MetaConfig, events: MetaEvent[]): Promise<void> {
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.pixelId}/events`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The token goes in the body, not the URL, so it never shows up in request logs.
    body: JSON.stringify({
      data: events,
      access_token: config.accessToken,
      ...(config.testEventCode && { test_event_code: config.testEventCode }),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 500);
    throw new Error(`Meta Conversions API answered ${response.status}: ${body}`);
  }
}

export interface MetaEvents {
  /** Sends the Purchase event of a new order; records the result on the order. Never throws. */
  sendPurchase(order: MetaOrder): Promise<void>;
  /** For the dashboard step: event when an order is confirmed by phone. Never throws. */
  sendOrderConfirmed(order: MetaOrder, confirmedAt?: Date): Promise<void>;
}

async function recordPurchase(orderId: MetaOrder["_id"], status: MetaEventStatus, error?: string) {
  await OrderModel.updateOne(
    { _id: orderId },
    {
      $set: {
        "metaPurchase.status": status,
        ...(status === "sent" && { "metaPurchase.sentAt": new Date() }),
        ...(error && { "metaPurchase.error": error.slice(0, 500) }),
      },
    },
  ).catch((dbError: unknown) =>
    logger.error("Could not record the Meta Purchase status", describeError(dbError)),
  );
}

/** Meta sender. Does nothing (status "skipped") when the Pixel ID or the token is not set. */
export function createMetaEvents(config: MetaConfig | null): MetaEvents {
  return {
    async sendPurchase(order) {
      if (!config) {
        await recordPurchase(order._id, "skipped");
        return;
      }
      try {
        await postMetaEvents(config, [buildPurchaseEvent(order)]);
        await recordPurchase(order._id, "sent");
      } catch (error) {
        logger.error("Meta Purchase event failed", {
          orderId: order._id.toString(),
          ...describeError(error),
        });
        await recordPurchase(
          order._id,
          "failed",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    async sendOrderConfirmed(order, confirmedAt) {
      if (!config) return;
      try {
        await postMetaEvents(config, [buildOrderConfirmedEvent(order, confirmedAt)]);
      } catch (error) {
        logger.error("Meta order confirmed event failed", {
          orderId: order._id.toString(),
          ...describeError(error),
        });
      }
    },
  };
}
