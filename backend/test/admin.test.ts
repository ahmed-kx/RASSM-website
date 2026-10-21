import { formatPrice } from "@rassm/shared";
import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminModel } from "../src/models/admin";
import { OrderModel } from "../src/models/order";
import { ProductModel } from "../src/models/product";
import {
  buildNewOrderEmail,
  createOrderNotifier,
  orderLink,
} from "../src/notifications/new-order-email";
import { MAX_FAILED_LOGINS } from "@rassm/shared";
import { LoginThrottleModel } from "../src/models/login-throttle";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  adminAgent,
  createTestAdmin,
  orderBody,
  testApp,
  ORIGIN,
} from "./helpers";

type Agent = Awaited<ReturnType<typeof adminAgent>>;

async function stockOf(productId: string, color: string, size: "S" | "M" | "L" | "XL" | "XXL") {
  const product = await ProductModel.findById(productId).lean();
  return product?.colors.find((c) => c.name === color)?.stock[size] ?? -1;
}

/** Places an order through the public API and returns its id. */
async function placeOrder(api: ReturnType<typeof testApp>["api"], overrides = {}) {
  const res = await api.post("/api/orders").send(orderBody(overrides)).expect(201);
  return res.body.eventId as string;
}

const setStatus = (agent: Agent, id: string, status: string) =>
  agent.post(`/api/admin/orders/${id}/status`).send({ status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("admin login", () => {
  it("logs in with an httpOnly SameSite=Strict cookie, then me and logout", async () => {
    const { api } = testApp();
    await createTestAdmin();
    const res = await api
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .send({ email: "Admin@Rassm.test", password: ADMIN_PASSWORD })
      .expect(200);
    expect(res.body.admin).toMatchObject({ email: ADMIN_EMAIL });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/^rassm_admin=[\w-]{40,};/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\//);

    const session = res.headers["set-cookie"] as unknown as string[];
    await api.get("/api/admin/auth/me").set("Cookie", session).expect(200);
    await api
      .post("/api/admin/auth/logout")
      .set("Origin", ORIGIN)
      .set("Cookie", session)
      .expect(200);
    await api.get("/api/admin/auth/me").set("Cookie", session).expect(401);
  });

  it("refuses a wrong password or an unknown e-mail with the same French message", async () => {
    const { api } = testApp();
    await createTestAdmin();
    const wrong = await api
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .send({ email: ADMIN_EMAIL, password: "pas-le-bon-mot" })
      .expect(401);
    const unknown = await api
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .send({ email: "inconnu@rassm.test", password: "pas-le-bon-mot" })
      .expect(401);
    expect(wrong.body.error.message).toBe("E-mail ou mot de passe incorrect.");
    expect(unknown.body).toEqual(wrong.body);
  });

  it(`locks the account after ${MAX_FAILED_LOGINS} failed logins, even with the right password`, async () => {
    const { api } = testApp();
    await createTestAdmin();
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      await api
        .post("/api/admin/auth/login")
        .set("Origin", ORIGIN)
        .send({ email: ADMIN_EMAIL, password: "faux-mot-de-passe" })
        .expect(401);
    }
    const locked = await api
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .send({ email: ADMIN_EMAIL, password: "faux-mot-de-passe" })
      .expect(429);
    expect(locked.body.error.message).toBe("Trop de tentatives. Réessayez dans 15 minutes.");
    await api
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(429);

    // Lock over: the right password works again.
    await LoginThrottleModel.updateMany({}, { $set: { lockedUntil: new Date(Date.now() - 1000) } });
    await api
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
  });

  it("answers a French 503 (not a generic error) when the database is unreachable", async () => {
    const { api } = testApp();
    const outage = Object.assign(new Error("querySrv ECONNREFUSED _mongodb._tcp.cluster.example"), {
      name: "MongooseServerSelectionError",
    });
    vi.spyOn(AdminModel, "findOne").mockRejectedValueOnce(outage);
    const res = await api
      .post("/api/admin/auth/login")
      .set("Origin", "http://localhost:3000")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(503);
    expect(res.body.error.message).toBe(
      "Le service est momentanément indisponible. Veuillez réessayer dans un instant.",
    );
    expect(JSON.stringify(res.body)).not.toContain("querySrv");
  });

  it("rate limits login attempts per IP", async () => {
    const { api } = testApp({ rateLimits: { login: { windowMs: 60_000, limit: 2 } } });
    await createTestAdmin();
    for (let i = 0; i < 2; i++) {
      await api
        .post("/api/admin/auth/login")
        .set("Origin", ORIGIN)
        .send({ email: "x@rassm.test", password: "x" })
        .expect(401);
    }
    await api
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .send({ email: "x@rassm.test", password: "x" })
      .expect(429);
  });

  it("protects every admin route (401 in French without a session)", async () => {
    const { api } = testApp();
    const call = {
      get: (path: string) => api.get(path),
      post: (path: string) => api.post(path).set("Origin", ORIGIN),
      patch: (path: string) => api.patch(path).set("Origin", ORIGIN),
      delete: (path: string) => api.delete(path).set("Origin", ORIGIN),
    };
    const routes: [keyof typeof call, string][] = [
      ["get", "/api/admin/auth/me"],
      ["get", "/api/admin/orders"],
      ["get", "/api/admin/search?q=yacine"],
      ["get", "/api/admin/orders/updates"],
      ["get", "/api/admin/orders/6710f0c2a1b2c3d4e5f60718"],
      ["patch", "/api/admin/orders/6710f0c2a1b2c3d4e5f60718"],
      ["post", "/api/admin/orders/6710f0c2a1b2c3d4e5f60718/status"],
      ["post", "/api/admin/orders/export"],
      ["post", "/api/admin/orders/ship"],
      ["get", "/api/admin/blacklist"],
      ["delete", "/api/admin/blacklist/0555123456"],
    ];
    for (const [method, path] of routes) {
      const res = await call[method](path);
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.body).toEqual({ error: { message: "Veuillez vous connecter." } });
    }
    await api
      .get("/api/admin/orders")
      .set("Cookie", "rassm_admin=not-a-real-session-token-123")
      .expect(401);
  });

  it("refuses changes coming from another site (CSRF)", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await agent
      .post("/api/admin/orders/ship")
      .set("Origin", "https://evil.example")
      .send({ ids: ["6710f0c2a1b2c3d4e5f60718"] })
      .expect(403);
  });
});

describe("admin orders", () => {
  it("lists orders by tab with counts, search and the Nouveau / opened state", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const first = await placeOrder(api);
    await placeOrder(api, {
      phone: "0661 00 00 01",
      fullName: "Amina Kaci",
      wilayaCode: 31,
      commune: "Oran",
    });

    const list = await agent.get("/api/admin/orders?status=pending").expect(200);
    expect(list.body.counts).toMatchObject({ pending: 2, confirmed: 0, all: 2 });
    expect(list.body.orders).toHaveLength(2);
    expect(list.body.orders[0]).toMatchObject({
      fullName: "Amina Kaci",
      openedAt: null,
      orderNumber: "RSM-000002",
    });

    const byPhone = await agent.get("/api/admin/orders?status=all&q=0661").expect(200);
    expect(byPhone.body.orders.map((o: { fullName: string }) => o.fullName)).toEqual([
      "Amina Kaci",
    ]);
    const byName = await agent.get("/api/admin/orders?status=all&q=yacine").expect(200);
    expect(byName.body.orders).toHaveLength(1);
    const byWilaya = await agent.get("/api/admin/orders?status=all&wilaya=31").expect(200);
    expect(byWilaya.body.counts.all).toBe(1);

    // Opening the order removes the "Nouveau" state.
    const detail = await agent.get(`/api/admin/orders/${first}`).expect(200);
    expect(detail.body.order.openedAt).not.toBeNull();
    expect(detail.body.product.id).toBe("prod_003");
    const updates = await agent.get("/api/admin/orders/updates").expect(200);
    expect(updates.body.unopened).toBe(1);
  });

  it("finds orders by internal order number and pages them by number", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    await placeOrder(api);
    await placeOrder(api, { phone: "0661 00 00 02", fullName: "Amina Kaci" });
    await placeOrder(api, { phone: "0661 00 00 03", fullName: "Sofiane Haddad" });

    const names = (res: { body: { orders: { fullName: string }[] } }) =>
      res.body.orders.map((order) => order.fullName);
    for (const q of ["RSM-000002", "rsm2", "rsm-000002", "2"]) {
      const res = await agent.get(`/api/admin/orders?status=all&q=${q}`).expect(200);
      expect(names(res), q).toEqual(["Amina Kaci"]);
    }
    // Digits also match phones (3 digits or more).
    const byDigits = await agent.get("/api/admin/orders?status=all&q=0661").expect(200);
    expect(names(byDigits)).toEqual(["Sofiane Haddad", "Amina Kaci"]);

    const page1 = await agent.get("/api/admin/orders?status=all&limit=2&page=1").expect(200);
    const page2 = await agent.get("/api/admin/orders?status=all&limit=2&page=2").expect(200);
    expect(names(page1)).toEqual(["Sofiane Haddad", "Amina Kaci"]);
    expect(names(page2)).toEqual(["Yacine Benali"]);
    expect(page2.body.counts.all).toBe(3);
  });

  it("searches orders and products from the top bar", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    await placeOrder(api);

    const byName = await agent.get("/api/admin/search?q=yaci").expect(200);
    expect(byName.body.orders).toEqual([
      expect.objectContaining({
        orderNumber: "RSM-000001",
        fullName: "Yacine Benali",
        status: "pending",
        productName: "Fragment Sweatshirt",
      }),
    ]);
    expect(byName.body.products).toEqual([]);

    const byNumber = await agent.get("/api/admin/search?q=RSM-000001").expect(200);
    expect(byNumber.body.orders).toHaveLength(1);

    const product = await agent.get("/api/admin/search?q=fragment").expect(200);
    expect(product.body.orders).toEqual([]);
    expect(product.body.products).toEqual([
      expect.objectContaining({ id: "prod_003", name: "Fragment Sweatshirt", isActive: true }),
    ]);
    expect(product.body.products[0].stock).toBeGreaterThan(0);

    // One letter: nothing (too short to be useful).
    const short = await agent.get("/api/admin/search?q=a").expect(200);
    expect(short.body).toEqual({ clients: [], orders: [], products: [] });
  });

  it("returns the orders created since the last poll", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const since = new Date(Date.now() - 1000).toISOString();
    await placeOrder(api);
    const res = await agent.get(`/api/admin/orders/updates?since=${since}`).expect(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].item.name).toBe("Fragment Sweatshirt");
  });

  it("allows only valid status changes, with history", async () => {
    const { app, api, metaEvents } = testApp();
    const agent = await adminAgent(app);
    const id = await placeOrder(api);

    const tooEarly = await setStatus(agent, id, "delivered").expect(409);
    expect(tooEarly.body.error.message).toBe("Impossible de passer de « Reçue » à « Livrée ».");
    await setStatus(agent, id, "shipped").expect(409);

    await setStatus(agent, id, "confirmed").expect(200);
    expect(metaEvents.sendOrderConfirmed).toHaveBeenCalledTimes(1);
    await setStatus(agent, id, "shipped").expect(200);
    const delivered = await setStatus(agent, id, "delivered").expect(200);
    expect(delivered.body.order.status).toBe("delivered");
    expect(delivered.body.order.history.map((h: { message: string }) => h.message)).toEqual([
      "Commande reçue sur le site.",
      "Statut : Reçue → Confirmée.",
      "Statut : Confirmée → Expédiée.",
      "Statut : Expédiée → Livrée.",
    ]);
    expect(delivered.body.order.history[1].by).toBe(ADMIN_EMAIL);
    await setStatus(agent, id, "pending").expect(409);
  });

  it("gives the stock back once when cancelled, takes it again when reopened", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const start = await stockOf("prod_003", "Noir", "M");
    const id = await placeOrder(api, { quantity: 2 });
    expect(await stockOf("prod_003", "Noir", "M")).toBe(start - 2);

    // Two clicks at the same time: the stock comes back once.
    const results = await Promise.all([
      setStatus(agent, id, "cancelled"),
      setStatus(agent, id, "cancelled"),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await stockOf("prod_003", "Noir", "M")).toBe(start);

    await setStatus(agent, id, "pending").expect(200);
    expect(await stockOf("prod_003", "Noir", "M")).toBe(start - 2);
    await setStatus(agent, id, "cancelled").expect(200);
    expect(await stockOf("prod_003", "Noir", "M")).toBe(start);
    expect((await OrderModel.findById(id).lean())?.stockReserved).toBe(false);
  });

  it("gives the stock back for an order saved before the stock flag existed", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const start = await stockOf("prod_003", "Noir", "M");
    const id = await placeOrder(api);
    await OrderModel.collection.updateOne(
      { _id: new Types.ObjectId(id) },
      { $unset: { stockReserved: "" } },
    );

    await setStatus(agent, id, "cancelled").expect(200);
    expect(await stockOf("prod_003", "Noir", "M")).toBe(start);
    expect((await OrderModel.findById(id).lean())?.stockReserved).toBe(false);
  });

  it("gives the stock back once when returned after delivery", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const start = await stockOf("prod_003", "Noir", "M");
    const id = await placeOrder(api);
    for (const status of ["confirmed", "shipped", "delivered", "returned"]) {
      await setStatus(agent, id, status).expect(200);
    }
    expect(await stockOf("prod_003", "Noir", "M")).toBe(start);
    await setStatus(agent, id, "returned").expect(409);
    expect(await stockOf("prod_003", "Noir", "M")).toBe(start);
  });

  it("refuses to reopen a cancelled order when the stock is gone", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const id = await placeOrder(api);
    await setStatus(agent, id, "cancelled").expect(200);
    await ProductModel.updateOne(
      { _id: "prod_003", "colors.name": "Noir" },
      { $set: { "colors.$.stock.M": 0 } },
    );
    const res = await setStatus(agent, id, "pending").expect(409);
    expect(res.body.error.message).toBe(
      "Impossible de réactiver la commande : La taille M est épuisée en Noir.",
    );
  });

  it("edits an order: recomputes the totals and moves the stock to the new variant", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const startM = await stockOf("prod_003", "Noir", "M");
    const startL = await stockOf("prod_003", "Noir", "L");
    const id = await placeOrder(api);

    const res = await agent
      .patch(`/api/admin/orders/${id}`)
      .send({
        color: "Noir",
        size: "L",
        quantity: 3,
        fullName: "Yacine Benali",
        phone: "0555123456",
        wilayaCode: 31,
        commune: "Bir El Djir",
        address: "Cité 500 logements",
        deliveryType: "home",
      })
      .expect(200);
    // 3 × 6 900 = 20 700, Oran home 750 DA, free delivery from 3 units.
    expect(res.body.order).toMatchObject({
      item: { size: "L", quantity: 3, unitPrice: 6900 },
      subtotal: 20700,
      deliveryFeeBase: 750,
      deliveryFee: 0,
      freeDelivery: true,
      total: 20700,
      wilayaCode: 31,
    });
    expect(res.body.order.history.at(-1).message).toBe(
      `Commande modifiée : Taille M → L, Quantité 1 → 3, Wilaya 16 - Alger → 31 - Oran, Commune Bab Ezzouar → Bir El Djir, Adresse modifiée, Total ${formatPrice(7200)} → ${formatPrice(20700)}.`,
    );
    expect(await stockOf("prod_003", "Noir", "M")).toBe(startM);
    expect(await stockOf("prod_003", "Noir", "L")).toBe(startL - 3);

    // Same variant, smaller quantity: only the difference comes back.
    await agent
      .patch(`/api/admin/orders/${id}`)
      .send({ ...res.body.order, quantity: 1, color: "Noir", size: "L" })
      .expect(200);
    expect(await stockOf("prod_003", "Noir", "L")).toBe(startL - 1);
  });

  it("refuses an edit above the stock, without touching it, in French", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    await ProductModel.updateOne(
      { _id: "prod_003", "colors.name": "Noir" },
      { $set: { "colors.$.stock.XL": 1 } },
    );
    const id = await placeOrder(api);
    const res = await agent
      .patch(`/api/admin/orders/${id}`)
      .send({ ...orderBody().order, phone: "0555123456", size: "XL", quantity: 2 })
      .expect(409);
    expect(res.body.error.fields.quantity).toBe("Il ne reste que 1 article en taille XL (Noir).");
    expect(await stockOf("prod_003", "Noir", "XL")).toBe(1);
    expect((await OrderModel.findById(id).lean())?.item.size).toBe("M");
  });

  it("refuses to edit a shipped order", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const id = await placeOrder(api);
    await setStatus(agent, id, "confirmed").expect(200);
    await setStatus(agent, id, "shipped").expect(200);
    await agent
      .patch(`/api/admin/orders/${id}`)
      .send({ ...orderBody().order, size: "L" })
      .expect(409);
  });

  it("saves an internal note", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const id = await placeOrder(api);
    const res = await agent
      .put(`/api/admin/orders/${id}/note`)
      .send({ note: "Client rappelle ce soir" })
      .expect(200);
    expect(res.body.order.adminNote).toBe("Client rappelle ce soir");
  });
});

describe("blacklist", () => {
  it("flags new orders from a blacklisted phone (still saved) and can be removed", async () => {
    const { app, api, notifier } = testApp();
    const agent = await adminAgent(app);
    const id = await placeOrder(api);
    await agent
      .post(`/api/admin/orders/${id}/blacklist`)
      .send({ reason: "Colis refusé" })
      .expect(200);

    const next = await placeOrder(api, { productId: "prod_001", color: "Noir", size: "L" });
    const detail = await agent.get(`/api/admin/orders/${next}`).expect(200);
    expect(detail.body.order.blacklist).toMatchObject({ reason: "Colis refusé" });
    expect(notifier.notifyNewOrder.mock.calls.at(-1)?.[1]).toEqual({
      blacklistReason: "Colis refusé",
    });

    const list = await agent.get("/api/admin/blacklist").expect(200);
    expect(list.body.entries).toEqual([
      expect.objectContaining({
        phone: "0555123456",
        reason: "Colis refusé",
        orderCount: 2,
        createdBy: ADMIN_EMAIL,
      }),
    ]);
    await agent.delete("/api/admin/blacklist/0555123456").expect(200);
    const after = await agent.get(`/api/admin/orders/${next}`).expect(200);
    expect(after.body.order.blacklist).toBeNull();
  });
});

describe("Anderson export", () => {
  it("exports the chosen confirmed orders as an Excel-friendly CSV, then ships them", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const home = await placeOrder(api);
    const desk = await placeOrder(api, {
      phone: "0661000001",
      fullName: "Amina Kaci",
      deliveryType: "stopdesk",
      address: "",
      quantity: 2,
    });
    const notConfirmed = await placeOrder(api, { phone: "0661000002" });
    await setStatus(agent, home, "confirmed").expect(200);
    await setStatus(agent, desk, "confirmed").expect(200);

    const res = await agent
      .post("/api/admin/orders/export")
      .send({ all: true })
      .buffer(true)
      .parse((response, callback) => {
        let data = "";
        response.on("data", (chunk: Buffer) => (data += chunk.toString("utf8")));
        response.on("end", () => callback(null, data));
      })
      .expect(200);
    expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers["content-disposition"]).toMatch(
      /attachment; filename="anderson-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const lines = (res.body as string)
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");
    expect(lines).toEqual([
      "Référence;Nom;Téléphone;Wilaya;Commune;Adresse;Type de livraison;Produit;Montant à encaisser (DA)",
      "RSM-000001;Yacine Benali;0555 12 34 56;16 - Alger;Bab Ezzouar;Cité 1200 logements, bâtiment 5;Domicile;RSM-S-001 Fragment Sweatshirt - Noir - Taille M - x1;7200",
      "RSM-000002;Amina Kaci;0661 00 00 01;16 - Alger;Bab Ezzouar;Stop desk (bureau Anderson);Stop desk;RSM-S-001 Fragment Sweatshirt - Noir - Taille M - x2;13850",
    ]);
    expect(res.headers["x-exported-ids"]).toBe(`${home},${desk}`);

    const shipped = await agent
      .post("/api/admin/orders/ship")
      .send({ ids: [home, desk, notConfirmed] })
      .expect(200);
    expect(shipped.body).toEqual({ shipped: 2, skipped: 1 });
    expect((await OrderModel.findById(home).lean())?.status).toBe("shipped");
    expect((await OrderModel.findById(notConfirmed).lean())?.status).toBe("pending");
  });

  it("refuses an export without confirmed orders, in French", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    const res = await agent.post("/api/admin/orders/export").send({ all: true }).expect(400);
    expect(res.body.error.message).toBe("Aucune commande confirmée à exporter.");
  });
});

describe("new order e-mail", () => {
  it("is sent for a real order, not for a duplicate or a honeypot", async () => {
    const { api, notifier } = testApp();
    await placeOrder(api);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(notifier.notifyNewOrder).toHaveBeenCalledTimes(1);
    expect(notifier.notifyNewOrder.mock.calls[0]?.[0]).toMatchObject({ orderNumber: "RSM-000001" });

    await placeOrder(api); // duplicate
    await api
      .post("/api/orders")
      .send(orderBody({ phone: "0661000009" }, { website: "spam" }))
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(notifier.notifyNewOrder).toHaveBeenCalledTimes(1);
  });

  it("calls Brevo with a French e-mail, and a failure never fails the order", async () => {
    const fetchMock = vi.fn(async () => new Response('{"messageId":"x"}', { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const notifier = createOrderNotifier({
      brevoApiKey: "xkeysib-test-0123456789abcdef",
      notifyEmail: "rassmwear@gmail.com",
      from: "rassmwear@gmail.com",
      adminUrl: "http://localhost:3000/admin",
    });
    const { api } = testApp({ notifier });
    const id = await placeOrder(api, { fullName: "Yacine <b>Benali</b>" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe(
      "xkeysib-test-0123456789abcdef",
    );
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      sender: { name: "RASSM", email: "rassmwear@gmail.com" },
      to: [{ email: "rassmwear@gmail.com" }],
      subject: `Nouvelle commande : Fragment Sweatshirt, ${formatPrice(7200)}`,
    });
    expect(body.htmlContent).toContain(orderLink("http://localhost:3000/admin", id));
    expect(body.htmlContent).toContain("Yacine &lt;b&gt;Benali&lt;/b&gt;");
    expect(body.textContent).toContain(`Total à encaisser : ${formatPrice(7200)}`);
    await vi.waitFor(async () =>
      expect((await OrderModel.findById(id).lean())?.emailNotification.status).toBe("sent"),
    );

    fetchMock.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));
    const failing = await placeOrder(api, { phone: "0661000003" });
    await vi.waitFor(async () =>
      expect((await OrderModel.findById(failing).lean())?.emailNotification.status).toBe("failed"),
    );
  });

  it("shows the blacklist and suspicious flags", () => {
    const email = buildNewOrderEmail(
      {
        _id: { toString: () => "abc" } as never,
        orderNumber: "RSM-000009",
        fullName: "Test",
        phone: "0555123456",
        wilayaCode: 16,
        commune: "Kouba",
        address: "Rue 1",
        deliveryType: "home",
        item: {
          productId: "p",
          color: "Noir",
          size: "M",
          quantity: 1,
          name: "Hoodie",
          slug: "h",
          image: "/x.jpg",
          unitPrice: 5000,
        },
        subtotal: 5000,
        deliveryFee: 400,
        deliveryDiscount: 0,
        freeDelivery: false,
        total: 5400,
        suspicious: true,
        suspiciousReason: "3 commandes avec ce numéro de téléphone en 24 h",
      },
      { blacklistReason: "Colis refusé" },
      "https://rassm.dz/admin",
    );
    expect(email.subject).toBe(`[Liste noire] Nouvelle commande : Hoodie, ${formatPrice(5400)}`);
    expect(email.text).toContain("Liste noire : Colis refusé");
    expect(email.text).toContain("Suspecte : 3 commandes avec ce numéro de téléphone en 24 h");
    expect(email.text).toContain("https://rassm.dz/admin/commandes/abc");
  });
});
