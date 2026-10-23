import express from "express";
import { MAX_FAILED_LOGINS, signClientIp } from "@rassm/shared";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { plainBackupRefusal } from "../src/backup";
import {
  MAX_CONCURRENT_PASSWORD_CHECKS,
  PasswordBusyError,
  verifyPassword,
} from "../src/lib/password";
import { errorHandler } from "../src/middleware/error-handler";
import { AdminModel } from "../src/models/admin";
import { AdminSessionModel } from "../src/models/admin-session";
import { ContactMessageModel } from "../src/models/contact-message";
import { NewsletterSubscriberModel } from "../src/models/newsletter-subscriber";
import { OrderModel } from "../src/models/order";
import { ProductModel } from "../src/models/product";
import { buildAlertEmail } from "../src/notifications/alert-email";
import { purgeOldClientData } from "../src/services/data-retention";
import { IP_UNITS_LIMIT_MESSAGE, SUSPICIOUS_QUANTITY_MESSAGE } from "../src/services/fraud";
import { confirmSubscription } from "../src/services/newsletter-sync";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ORIGIN,
  TEST_PROXY_SECRET,
  adminAgent,
  createTestAdmin,
  csrfFrom,
  fakeNewsletterList,
  orderBody,
  testApp,
  viaSite,
} from "./helpers";

// Fixes of the independent security review (October 2026): client IP, fake orders, account
// lock, password checks, Meta, privacy, newsletter double opt-in, backups.

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const right = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
const wrong = { email: ADMIN_EMAIL, password: "pas-le-bon-mot-de-passe" };
const MINUTE = 60_000;

/** The IP the API recorded for the admin's latest session. */
async function lastSessionIp() {
  return (await AdminSessionModel.findOne().sort({ createdAt: -1 }).lean())?.ip;
}

describe("H1: the dashboard's client IP", () => {
  it("ignores a forged X-Forwarded-For and uses the IP signed by the website", async () => {
    const { api } = testApp();
    await createTestAdmin();
    const login = () => api.post("/api/admin/auth/login").set("Origin", ORIGIN);

    await login().set("X-Forwarded-For", "203.0.113.66").send(right).expect(200);
    expect(await lastSessionIp()).toMatch(/^(127\.0\.0\.1|::1)$/);

    await login().set(viaSite("198.51.100.42")).send(right).expect(200);
    expect(await lastSessionIp()).toBe("198.51.100.42");

    // Signed with another secret, or two minutes old (replayed): not trusted.
    await login().set(viaSite("198.51.100.43", "un-autre-secret-0123456789-abcdefgh")).send(right);
    expect(await lastSessionIp()).toMatch(/^(127\.0\.0\.1|::1)$/);
    await login()
      .set(viaSite("198.51.100.44", TEST_PROXY_SECRET, Date.now() - 2 * MINUTE))
      .send(right);
    expect(await lastSessionIp()).toMatch(/^(127\.0\.0\.1|::1)$/);
  });

  it("cannot get around the IP lock by writing another X-Forwarded-For each time", async () => {
    const { api } = testApp();
    await createTestAdmin();
    for (let i = 1; i <= MAX_FAILED_LOGINS; i++) {
      await api
        .post("/api/admin/auth/login")
        .set("Origin", ORIGIN)
        .set("X-Forwarded-For", `203.0.113.${i}`)
        .send({ email: `essai${i}@rassm.test`, password: "x" });
    }
    const blocked = await api
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .set("X-Forwarded-For", "203.0.113.200")
      .send(right)
      .expect(429);
    expect(blocked.body.error.message).toMatch(/^Trop de tentatives/);
  });

  it("public routes read X-Forwarded-For only for the TRUST_PROXY proxies", async () => {
    const direct = testApp({ trustProxy: 0 });
    await direct.api
      .post("/api/orders")
      .set("X-Forwarded-For", "203.0.113.9")
      .send(orderBody())
      .expect(201);
    expect((await OrderModel.findOne().lean())?.client.ip).toMatch(/^(127\.0\.0\.1|::1)$/);
    await OrderModel.deleteMany({});

    const proxied = testApp({ trustProxy: 1 });
    // The visitor wrote "1.2.3.4"; the host's proxy added the real address at the end.
    await proxied.api
      .post("/api/orders")
      .set("X-Forwarded-For", "1.2.3.4, 41.200.10.20")
      .send(orderBody())
      .expect(201);
    expect((await OrderModel.findOne().lean())?.client.ip).toBe("41.200.10.20");
  });

  it("signs exactly like the website (shared signClientIp)", async () => {
    const time = 1_761_000_000_000;
    const expected = await signClientIp(TEST_PROXY_SECRET, "41.200.10.20", time);
    expect(viaSite("41.200.10.20", TEST_PROXY_SECRET, time)["x-rassm-client-ip-signature"]).toBe(
      expected,
    );
    expect(expected).toMatch(/^1761000000000\.[0-9a-f]{64}$/);
  });
});

describe("H2: fake orders and stock", () => {
  it("accepts 5 units per order at most", async () => {
    const { api } = testApp();
    const res = await api
      .post("/api/orders")
      .send(orderBody({ productId: "prod_005", size: "M", quantity: 6 }))
      .expect(400);
    expect(res.body.error.fields["order.quantity"] ?? res.body.error.fields.quantity).toBe(
      "Vous pouvez commander au maximum 5 exemplaires du même article.",
    );
  });

  it("flags and e-mails once beyond 15 units from one IP in 24 h, and limits suspicious orders to 3 units", async () => {
    const { api, notifier } = testApp();
    const send = (order: Parameters<typeof orderBody>[0]) =>
      api.post("/api/orders").send(orderBody(order));
    await send({ phone: "0551000001", productId: "prod_005", size: "M", quantity: 5 }).expect(201);
    await send({ phone: "0551000002", productId: "prod_005", size: "L", quantity: 5 }).expect(201);
    await send({
      phone: "0551000003",
      productId: "prod_004",
      color: "Crème",
      size: "M",
      quantity: 5,
    }).expect(201);
    // 15 units: several customers of the same operator, nothing flagged.
    expect(await OrderModel.countDocuments({ suspicious: true })).toBe(0);

    // The next one goes beyond 15 units: suspicious, so 3 units at most (French, under quantity).
    const tooMany = await send({
      phone: "0551000004",
      productId: "prod_004",
      color: "Crème",
      size: "L",
      quantity: 4,
    }).expect(409);
    expect(tooMany.body.error.fields.quantity).toBe(SUSPICIOUS_QUANTITY_MESSAGE);
    expect((await ProductModel.findById("prod_004").lean())?.colors[0]?.stock.L).toBe(15);

    await send({
      phone: "0551000004",
      productId: "prod_004",
      color: "Crème",
      size: "L",
      quantity: 3,
    }).expect(201);
    const flagged = await OrderModel.findOne({ phone: "0551000004" }).lean();
    expect(flagged).toMatchObject({
      suspicious: true,
      suspiciousReason: "4 commandes (18 articles) depuis la même adresse IP en 24 h",
      stockReserved: true,
    });
    await vi.waitFor(() =>
      expect(notifier.notifyAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "ip",
          orders: 4,
          units: 18,
          orderNumber: flagged?.orderNumber,
        }),
      ),
    );
    // One alert per IP per day.
    await send({ phone: "0551000005", productId: "prod_001", size: "L", quantity: 1 }).expect(201);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const ipAlerts = notifier.notifyAlert.mock.calls.filter(([alert]) => alert.kind === "ip");
    expect(ipAlerts).toHaveLength(1);
  });

  it("refuses beyond 60 units from one IP in 24 h (cancelled orders not counted)", async () => {
    const { api } = testApp();
    await api.post("/api/orders").send(orderBody()).expect(201);
    const ip = (await OrderModel.findOne().lean())?.client.ip;
    await OrderModel.collection.insertOne({
      client: { ip, userAgent: null },
      createdAt: new Date(),
      status: "pending",
      item: { quantity: 57 },
    });
    // 1 + 57 + 3 = 61 units: refused, nothing taken.
    const refused = await api
      .post("/api/orders")
      .send(orderBody({ phone: "0661000001", productId: "prod_001", size: "L", quantity: 3 }))
      .expect(429);
    expect(refused.body.error.message).toBe(IP_UNITS_LIMIT_MESSAGE);
    expect((await ProductModel.findById("prod_001").lean())?.colors[0]?.stock.L).toBe(14);
    await OrderModel.collection.updateOne(
      { "item.quantity": 57 },
      { $set: { status: "cancelled" } },
    );
    await api
      .post("/api/orders")
      .send(orderBody({ phone: "0661000001", productId: "prod_001", size: "L", quantity: 3 }))
      .expect(201);
  });

  it("e-mails the team when a size loses more than half of its stock within an hour", async () => {
    const { api, notifier } = testApp();
    await ProductModel.updateOne(
      { _id: "prod_003", "colors.name": "Noir" },
      { $set: { "colors.$.stock.M": 6 } },
    );
    await api
      .post("/api/orders")
      .send(orderBody({ quantity: 2 }))
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(notifier.notifyAlert).not.toHaveBeenCalled(); // 2 of 6: normal
    await api
      .post("/api/orders")
      .send(orderBody({ phone: "0661000002", quantity: 2 }))
      .expect(201);
    await vi.waitFor(() =>
      expect(notifier.notifyAlert).toHaveBeenCalledWith({
        kind: "stock",
        productId: "prod_003",
        productName: "Fragment Sweatshirt",
        color: "Noir",
        size: "M",
        lost: 4,
        before: 6,
        remaining: 2,
      }),
    );
    // Once per size per hour.
    await api
      .post("/api/orders")
      .send(orderBody({ phone: "0661000003", quantity: 1 }))
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(notifier.notifyAlert).toHaveBeenCalledTimes(1);
    const [alert] = notifier.notifyAlert.mock.calls[0] ?? [];
    if (!alert) throw new Error("No alert");
    const email = buildAlertEmail(alert, "https://x/admin");
    expect(email.text).toContain("Cette taille a perdu 67 % de son stock en moins d'une heure.");
    expect(email.text).toContain("appelez avant d'annuler");
  });

  it("« Annuler » on several orders: new and confirmed ones only, stock given back once", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const a = (await api.post("/api/orders").send(orderBody()).expect(201)).body.eventId;
    const b = (
      await api
        .post("/api/orders")
        .send(orderBody({ phone: "0661000004", productId: "prod_001", size: "L" }))
        .expect(201)
    ).body.eventId;
    await agent.post(`/api/admin/orders/${b}/status`).send({ status: "confirmed" }).expect(200);
    await agent.post(`/api/admin/orders/${b}/status`).send({ status: "shipped" }).expect(200);
    const res = await agent
      .post("/api/admin/orders/cancel")
      .send({ ids: [a, b] })
      .expect(200);
    expect(res.body).toEqual({ cancelled: 1, skipped: 1 });
    expect((await OrderModel.findById(a).lean())?.status).toBe("cancelled");
    expect((await OrderModel.findById(b).lean())?.status).toBe("shipped");
    expect((await ProductModel.findById("prod_003").lean())?.colors[0]?.stock.M).toBe(10);
    // Without a session: refused.
    await request(app)
      .post("/api/admin/orders/cancel")
      .set("Origin", ORIGIN)
      .send({ ids: [a] })
      .expect(401);
  });
});

describe("M5: Meta Purchase and bots", () => {
  it("never sends the server Purchase of an order sent too fast or without the form", async () => {
    const { app, api, metaEvents } = testApp();
    const agent = await adminAgent(app);
    const bot = await api
      .post("/api/orders")
      .send(orderBody({}, { elapsedMs: undefined }))
      .expect(201);
    const fast = await api
      .post("/api/orders")
      .send(orderBody({ phone: "0661000005" }, { elapsedMs: 400 }))
      .expect(201);
    // Another suspicious reason (3rd order of a phone) is still sent.
    for (const productId of ["prod_001", "prod_004", "prod_002"]) {
      const color = productId === "prod_001" ? "Noir" : "Crème";
      await api
        .post("/api/orders")
        .send(orderBody({ phone: "0661000006", productId, color, size: "L" }))
        .expect(201);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    const sent = metaEvents.sendPurchase.mock.calls.map(([order]) => order._id.toString());
    expect(sent).not.toContain(bot.body.eventId);
    expect(sent).not.toContain(fast.body.eventId);
    expect(sent).toHaveLength(3);
    const third = await OrderModel.findOne({ phone: "0661000006" }).sort({ createdAt: -1 }).lean();
    expect(third?.suspicious).toBe(true);
    expect(sent).toContain(third?._id.toString());

    const detail = await agent.get(`/api/admin/orders/${bot.body.eventId}`).expect(200);
    expect(detail.body.order).toMatchObject({
      metaPurchaseStatus: "skipped",
      metaPurchaseNote: "robot probable (formulaire envoyé trop vite ou sans le site)",
    });
  });
});

describe("M1, L7: account lock and known browsers", () => {
  it("an attacker locking the account never locks out a browser the admin already used", async () => {
    const { app, api } = testApp();
    await createTestAdmin();
    const laptop = request.agent(app);
    await laptop
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .set(viaSite("198.51.100.1"))
      .send(right)
      .expect(200);

    const attacker = () =>
      api.post("/api/admin/auth/login").set("Origin", ORIGIN).set(viaSite("203.0.113.50"));
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await attacker().send(wrong);
    await attacker().send(right).expect(429);
    // Another unknown browser, elsewhere: still locked.
    await api
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .set(viaSite("203.0.113.51"))
      .send(right)
      .expect(429);
    // The admin's own browser (device cookie): logs in.
    await laptop
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .set(viaSite("198.51.100.1"))
      .send(right)
      .expect(200);
  });

  it("5 wrong current passwords lock the account and close the session (stolen session)", async () => {
    const { app, securityMailer } = testApp();
    await createTestAdmin();
    const thief = request.agent(app);
    const login = await thief
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .set(viaSite("203.0.113.60"))
      .send(right)
      .expect(200);
    // Another browser of the same session cookie: not a known device of the admin.
    const stolen = request(app);
    const cookie = String(login.headers["set-cookie"]).match(/rassm_admin=[^;]+/)?.[0] ?? "";
    const change = () =>
      stolen
        .post("/api/admin/security/password")
        .set("Origin", ORIGIN)
        .set("Cookie", cookie)
        .set(viaSite("203.0.113.61"))
        .set("x-csrf-token", csrfFrom(login) ?? "")
        .send({ currentPassword: "devine-encore-1234", newPassword: "Bleu-nuit-sur-la-ville-42" });
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) await change().expect(400);
    const locked = await change().expect(429);
    expect(locked.body.error.message).toMatch(/^Trop de tentatives/);
    await stolen.get("/api/admin/auth/me").set("Cookie", cookie).expect(401);
    await vi.waitFor(() =>
      expect(securityMailer.sendAlert).toHaveBeenCalledWith(
        ADMIN_EMAIL,
        expect.objectContaining({ kind: "locked" }),
      ),
    );
    expect((await AdminModel.findOne().lean())?.passwordHash).toBeTruthy();
  });
});

describe("M7: password checks and login limits", () => {
  it("runs at most 3 password checks at once, then answers 503 in French", async () => {
    const stored = (await createTestAdmin()).passwordHash;
    const checks = Array.from({ length: MAX_CONCURRENT_PASSWORD_CHECKS + 1 }, () =>
      verifyPassword(ADMIN_PASSWORD, stored),
    );
    const results = await Promise.allSettled(checks);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      MAX_CONCURRENT_PASSWORD_CHECKS,
    );
    expect(results.at(-1)).toMatchObject({
      status: "rejected",
      reason: expect.any(PasswordBusyError),
    });

    const busy = express().get("/", () => {
      throw new PasswordBusyError();
    });
    busy.use(errorHandler);
    const res = await request(busy).get("/").expect(503);
    expect(res.body.error.message).toBe(
      "Le service est très sollicité. Veuillez réessayer dans un instant.",
    );
  });

  it("limits logins from every IP together, except from a browser the admin already used", async () => {
    const { app, api } = testApp({ rateLimits: { loginAll: { windowMs: 60_000, limit: 3 } } });
    await createTestAdmin();
    const laptop = request.agent(app);
    await laptop
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .set(viaSite("198.51.100.1"))
      .send(right)
      .expect(200);
    for (let i = 0; i < 2; i++) {
      await api
        .post("/api/admin/auth/login")
        .set("Origin", ORIGIN)
        .set(viaSite(`203.0.113.${70 + i}`))
        .send({ email: `autre${i}@rassm.test`, password: "x" })
        .expect(401);
    }
    await api
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .set(viaSite("203.0.113.80"))
      .send(right)
      .expect(429);
    await laptop
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .set(viaSite("198.51.100.1"))
      .send(right)
      .expect(200);
  });
});

describe("L2: password reset requests", () => {
  it("answers at once and handles them one after the other (3 e-mails per hour, even at once)", async () => {
    const { api, securityMailer } = testApp();
    await createTestAdmin();
    const forgot = () =>
      api
        .post("/api/admin/auth/password/forgot")
        .set("Origin", ORIGIN)
        .send({ email: ADMIN_EMAIL });
    const answers = await Promise.all(Array.from({ length: 5 }, forgot));
    expect(answers.map((res) => res.status)).toEqual([200, 200, 200, 200, 200]);
    await vi.waitFor(() => expect(securityMailer.sendPasswordReset).toHaveBeenCalledTimes(3));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(securityMailer.sendPasswordReset).toHaveBeenCalledTimes(3);
  });
});

describe("M6: data retention", () => {
  it("deletes IP addresses and browsers older than 12 months, and only those", async () => {
    const old = new Date(Date.now() - 400 * 24 * 60 * MINUTE);
    const { api } = testApp();
    await api.post("/api/orders").set("User-Agent", "Recent/1.0").send(orderBody()).expect(201);
    await OrderModel.collection.insertOne({
      createdAt: old,
      client: { ip: "41.200.1.1", userAgent: "Old/1.0" },
      item: { quantity: 1 },
      status: "delivered",
    });
    await ContactMessageModel.collection.insertOne({
      createdAt: old,
      client: { ip: "41.200.1.2", userAgent: "Old/1.0" },
    });
    await NewsletterSubscriberModel.collection.insertOne({
      email: "ancien@example.com",
      createdAt: old,
      client: { ip: "41.200.1.3", userAgent: "Old/1.0" },
    });
    expect(await purgeOldClientData()).toEqual({ orders: 1, messages: 1, subscribers: 1 });
    expect(await OrderModel.countDocuments({ "client.ip": "41.200.1.1" })).toBe(0);
    expect(
      (await OrderModel.findOne({ "client.userAgent": "Recent/1.0" }).lean())?.client.ip,
    ).toBeTruthy();
    expect((await ContactMessageModel.findOne().lean())?.client).toEqual({
      ip: null,
      userAgent: null,
    });
    expect(await purgeOldClientData()).toEqual({ orders: 0, messages: 0, subscribers: 0 });
  });
});

describe("L8: newsletter confirmation link", () => {
  it("expires after 7 days", async () => {
    const newsletterList = fakeNewsletterList();
    const { api } = testApp({ newsletterList });
    await api
      .post("/api/newsletter")
      .send({ elapsedMs: 9000, email: "tard@example.com" })
      .expect(201);
    await vi.waitFor(() => expect(newsletterList.sendConfirmation).toHaveBeenCalled());
    const token =
      (newsletterList.sendConfirmation.mock.calls[0]?.[1] ?? "").split("#jeton=")[1] ?? "";
    const later = new Date(Date.now() + 8 * 24 * 60 * MINUTE);
    await expect(confirmSubscription(token, newsletterList, later)).rejects.toMatchObject({
      status: 400,
    });
    expect(newsletterList.add).not.toHaveBeenCalled();
  });
});

describe("L3: backups", () => {
  it("refuses an unencrypted backup in production, unless asked on purpose", () => {
    expect(plainBackupRefusal({ production: true, allowPlain: false })).toMatch(
      /BACKUP_PASSPHRASE/,
    );
    expect(plainBackupRefusal({ production: true, allowPlain: true })).toBeNull();
    expect(
      plainBackupRefusal({ production: true, passphrase: "x".repeat(20), allowPlain: false }),
    ).toBeNull();
    expect(plainBackupRefusal({ production: false, allowPlain: false })).toBeNull();
  });
});
