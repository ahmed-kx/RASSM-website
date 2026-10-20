import type { OrderRequest } from "@rassm/shared";
import request from "supertest";
import { vi } from "vitest";
import { createApp, type AppOptions } from "../src/app";
import { hashPassword } from "../src/lib/password";
import type { MetaEvents } from "../src/meta/conversions-api";
import { AdminModel } from "../src/models/admin";
import type { OrderNotifier } from "../src/notifications/new-order-email";
import type { Revalidator } from "../src/lib/revalidate";
import type { ImageStorage } from "../src/services/image-storage";

export const FAKE_STORAGE_BASE =
  "https://res.cloudinary.com/test-cloud/image/upload/v1/rassm/products/";

/** A Cloudinary stand-in: keeps the uploaded photos in memory. */
export function fakeImageStorage() {
  const stored = new Set<string>();
  let next = 0;
  const storage = {
    stored,
    upload: vi.fn<ImageStorage["upload"]>(async () => {
      next += 1;
      const url = `${FAKE_STORAGE_BASE}photo-${next}.webp`;
      stored.add(url);
      return { url, width: 1200, height: 1200 };
    }),
    owns: (url: string) => url.startsWith(FAKE_STORAGE_BASE),
    remove: vi.fn<ImageStorage["remove"]>(async (url) => {
      stored.delete(url);
    }),
  };
  return storage satisfies ImageStorage;
}

/** Records the pages the API asks the website to refresh. */
export function fakeRevalidator() {
  return { revalidate: vi.fn<Revalidator["revalidate"]>() } satisfies Revalidator;
}

/** A Meta sender that records calls instead of calling Meta. */
export function fakeMetaEvents() {
  return {
    sendPurchase: vi.fn<MetaEvents["sendPurchase"]>(async () => undefined),
    sendOrderConfirmed: vi.fn<MetaEvents["sendOrderConfirmed"]>(async () => undefined),
  } satisfies MetaEvents;
}

/** A notifier that records calls instead of sending e-mails. */
export function fakeNotifier() {
  return {
    notifyNewOrder: vi.fn<OrderNotifier["notifyNewOrder"]>(async () => undefined),
  } satisfies OrderNotifier;
}

/** The app with high rate limits (unless a test sets its own) and fake Meta / e-mail senders. */
export function testApp(options: Partial<AppOptions> = {}) {
  const metaEvents = fakeMetaEvents();
  const notifier = fakeNotifier();
  const imageStorage = fakeImageStorage();
  const revalidator = fakeRevalidator();
  const high = { windowMs: 60_000, limit: 1000 };
  const app = createApp({
    frontendOrigins: ["http://localhost:3000"],
    trustProxy: 0,
    metaEvents,
    notifier,
    secureCookies: false,
    imageStorage,
    revalidator,
    ...options,
    rateLimits: {
      orders: high,
      contact: high,
      newsletter: high,
      login: high,
      admin: high,
      ...options.rateLimits,
    },
  });
  return { app, metaEvents, notifier, imageStorage, revalidator, api: request(app) };
}

export const ADMIN_EMAIL = "admin@rassm.test";
export const ADMIN_PASSWORD = "mot-de-passe-solide";

export async function createTestAdmin(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  return AdminModel.create({ email, passwordHash: await hashPassword(password) });
}

/** A logged-in supertest agent (keeps the session cookie). */
export async function adminAgent(app: ReturnType<typeof testApp>["app"]) {
  await createTestAdmin();
  const agent = request.agent(app);
  await agent
    .post("/api/admin/auth/login")
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    .expect(200);
  return agent;
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
