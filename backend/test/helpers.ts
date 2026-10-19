import type { OrderRequest } from "@rassm/shared";
import request from "supertest";
import { vi } from "vitest";
import { createApp, type AppOptions } from "../src/app";
import type { MetaEvents } from "../src/meta/conversions-api";

/** A Meta sender that records calls instead of calling Meta. */
export function fakeMetaEvents() {
  return {
    sendPurchase: vi.fn<MetaEvents["sendPurchase"]>(async () => undefined),
    sendOrderConfirmed: vi.fn<MetaEvents["sendOrderConfirmed"]>(async () => undefined),
  } satisfies MetaEvents;
}

/** The app with high rate limits (unless a test sets its own) and a fake Meta sender. */
export function testApp(options: Partial<AppOptions> = {}) {
  const metaEvents = fakeMetaEvents();
  const high = { windowMs: 60_000, limit: 1000 };
  const app = createApp({
    frontendOrigins: ["http://localhost:3000"],
    trustProxy: 0,
    metaEvents,
    rateLimits: { orders: high, contact: high, newsletter: high },
    ...options,
  });
  return { app, metaEvents, api: request(app) };
}

// Fragment Sweatshirt (prod_003): 6 900 DA, tiers 1 → −100 DA, 2 → −200 DA, 3 → free.
// Alger (16): 400 DA home, 250 DA stop desk. Tindouf (37): no stop desk.
export const baseOrder = {
  productId: "prod_003",
  color: "Noir",
  size: "M",
  quantity: 1,
  fullName: "Yacine Benali",
  phone: "0555 12 34 56",
  wilayaCode: 16,
  commune: "Bab Ezzouar",
  deliveryType: "home",
  address: "Cité 1200 logements, bâtiment 5",
} satisfies OrderRequest["order"];

export function orderBody(
  order: Partial<OrderRequest["order"]> & Record<string, unknown> = {},
  extra: Omit<Partial<OrderRequest>, "order"> = {},
) {
  return { order: { ...baseOrder, ...order }, ...extra };
}
