import { afterEach, describe, expect, it, vi } from "vitest";
import { AdSpendModel } from "../src/models/ad-spend";
import { BlacklistModel } from "../src/models/blacklist";
import { ContactMessageModel } from "../src/models/contact-message";
import { NewsletterSubscriberModel } from "../src/models/newsletter-subscriber";
import { OrderModel } from "../src/models/order";
import { ProductModel } from "../src/models/product";
import { saveSettings } from "../src/models/setting";
import { buildNewMessageEmail } from "../src/notifications/new-message-email";
import { createBrevoNewsletterList } from "../src/services/newsletter-sync";
import { adminAgent, fakeNewsletterList, orderBody, testApp, ORIGIN } from "./helpers";

// Tableau de bord, Publicité, Clients, Messages and Abonnés.

let orderCount = 0;

interface TestOrder {
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "returned";
  /** ISO instant, e.g. "2026-03-02T10:00:00+01:00". */
  at: string;
  phone: string;
  wilaya?: number;
  productId?: string;
  name?: string;
  color?: string;
  quantity?: number;
  unitPrice?: number;
  unitCost?: number | null;
  /** Delivery discount given (the base fee is 400 DA). */
  discount?: number;
  costs?: { packaging?: number; returnCost?: number };
  fullName?: string;
}

/** Inserts an order as it would be stored (amounts add up). */
async function insertOrder(order: TestOrder) {
  orderCount += 1;
  const quantity = order.quantity ?? 1;
  const unitPrice = order.unitPrice ?? 7000;
  const subtotal = unitPrice * quantity;
  const discount = order.discount ?? 0;
  const free = discount === 400;
  return OrderModel.create({
    orderNumber: `RSM-${String(900000 + orderCount).padStart(6, "0")}`,
    fullName: order.fullName ?? `Client ${order.phone.slice(-2)}`,
    phone: order.phone,
    wilayaCode: order.wilaya ?? 16,
    commune: "Commune",
    address: "Adresse de test",
    deliveryType: "home",
    item: {
      productId: order.productId ?? "prod_003",
      color: order.color ?? "Noir",
      size: "M",
      quantity,
      name: order.name ?? "Fragment Sweatshirt",
      slug: "fragment-sweatshirt",
      image: "/images/products/fragment-sweatshirt-front.jpg",
      unitPrice,
      unitCost: order.unitCost === undefined ? null : order.unitCost,
    },
    subtotal,
    deliveryFeeBase: 400,
    deliveryDiscount: discount,
    deliveryFee: 400 - discount,
    freeDelivery: free,
    deliveryDiscountLines: discount
      ? [
          {
            productId: order.productId ?? "prod_003",
            productName: "Fragment Sweatshirt",
            quantity,
            tier: free
              ? { type: "free", minQuantity: quantity }
              : { type: "amount", minQuantity: quantity, amount: discount },
            amount: free ? 400 : discount,
          },
        ]
      : [],
    total: subtotal + 400 - discount,
    status: order.status,
    ...(order.costs && { costs: order.costs }),
    createdAt: new Date(order.at),
  });
}

/** The March 2026 data set of the profit test (and one order in February). */
async function marchData() {
  await saveSettings({ packagingCost: 200, returnCost: 500 });
  // A: delivered, cost known, 100 DA discount, packaging copied at 150 DA.
  await insertOrder({
    status: "delivered",
    at: "2026-03-02T10:00:00+01:00",
    phone: "0550000001",
    unitCost: 3000,
    discount: 100,
    costs: { packaging: 150 },
  });
  // B: delivered, 2 units, no cost price (coût manquant), free delivery, no packaging copied.
  await insertOrder({
    status: "delivered",
    at: "2026-03-10T12:00:00+01:00",
    phone: "0550000002",
    quantity: 2,
    discount: 400,
  });
  // C: returned, return 600 DA + packaging 150 DA copied.
  await insertOrder({
    status: "returned",
    at: "2026-03-12T09:00:00+01:00",
    phone: "0550000001",
    wilaya: 31,
    unitCost: 3000,
    costs: { packaging: 150, returnCost: 600 },
  });
  await insertOrder({
    status: "confirmed",
    at: "2026-03-20T09:00:00+01:00",
    phone: "0550000003",
    wilaya: 31,
    unitPrice: 5000,
    productId: "prod_001",
    name: "Signature Hoodie",
  });
  await insertOrder({
    status: "shipped",
    at: "2026-03-25T09:00:00+01:00",
    phone: "0550000004",
    wilaya: 9,
    unitPrice: 6000,
    productId: "prod_001",
    name: "Signature Hoodie",
  });
  await insertOrder({
    status: "pending",
    at: "2026-03-28T09:00:00+01:00",
    phone: "0550000005",
    unitPrice: 5000,
  });
  await insertOrder({
    status: "cancelled",
    at: "2026-03-29T09:00:00+01:00",
    phone: "0550000006",
    wilaya: 6,
    unitPrice: 5000,
  });
  // Previous period (29 Jan – 28 Feb): one delivered order.
  await insertOrder({
    status: "delivered",
    at: "2026-02-10T09:00:00+01:00",
    phone: "0550000007",
    unitPrice: 5000,
    unitCost: 2000,
    costs: { packaging: 150 },
  });
  // Ads: 3 000 DA over 25 Feb – 6 Mar (10 days: 300 DA a day), 1 000 DA on 15 Mar.
  await AdSpendModel.create([
    { startDate: "2026-02-25", endDate: "2026-03-06", amount: 3000, note: "Campagne Drop 001" },
    { startDate: "2026-03-15", endDate: "2026-03-15", amount: 1000, note: "" },
  ]);
}

const MARCH = "from=2026-03-01&to=2026-03-31";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin insights: access", () => {
  it("protects every statistics, ads, clients, messages and subscribers route (401)", async () => {
    const { api } = testApp();
    const calls: [string, () => PromiseLike<{ status: number }>][] = [
      ["GET stats", () => api.get(`/api/admin/stats?${MARCH}`)],
      ["GET ads", () => api.get("/api/admin/ads")],
      ["POST ads", () => api.post("/api/admin/ads").set("Origin", ORIGIN).send({})],
      ["PUT ads", () => api.put("/api/admin/ads/abc").set("Origin", ORIGIN).send({})],
      ["DELETE ads", () => api.delete("/api/admin/ads/abc").set("Origin", ORIGIN)],
      ["GET clients", () => api.get("/api/admin/clients")],
      ["GET clients export", () => api.get("/api/admin/clients/export")],
      ["GET client", () => api.get("/api/admin/clients/0550000001")],
      ["GET messages", () => api.get("/api/admin/messages")],
      ["GET message", () => api.get("/api/admin/messages/abc")],
      [
        "PATCH message",
        () => api.patch("/api/admin/messages/abc").set("Origin", ORIGIN).send({ read: true }),
      ],
      ["DELETE message", () => api.delete("/api/admin/messages/abc").set("Origin", ORIGIN)],
      ["GET subscribers", () => api.get("/api/admin/subscribers")],
      ["GET subscribers export", () => api.get("/api/admin/subscribers/export")],
      [
        "POST subscriber sync",
        () => api.post("/api/admin/subscribers/abc/sync").set("Origin", ORIGIN),
      ],
      ["DELETE subscriber", () => api.delete("/api/admin/subscribers/abc").set("Origin", ORIGIN)],
    ];
    for (const [label, call] of calls) {
      expect((await call()).status, label).toBe(401);
    }
  });
});

describe("admin insights: costs", () => {
  it("keeps the cost price out of the public API and copies it on each new order", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    await ProductModel.updateOne({ _id: "prod_003" }, { $set: { costPrice: 3000 } });

    const detail = await agent.get("/api/admin/products/prod_003").expect(200);
    expect(detail.body.costPrice).toBe(3000);
    const publicProduct = await api.get("/api/products/fragment-sweatshirt").expect(200);
    expect(JSON.stringify(publicProduct.body)).not.toContain("costPrice");
    const publicList = await api.get("/api/products").expect(200);
    expect(JSON.stringify(publicList.body)).not.toContain("costPrice");

    const placed = await api.post("/api/orders").send(orderBody()).expect(201);
    expect(JSON.stringify(placed.body)).not.toContain("unitCost");
    // A later cost change never rewrites the cost of past orders.
    await ProductModel.updateOne({ _id: "prod_003" }, { $set: { costPrice: 5000 } });
    const order = await agent.get(`/api/admin/orders/${placed.body.eventId}`).expect(200);
    expect(order.body.order.unitCost).toBe(3000);
  });

  it("stores no cost on an order of a product without cost price (coût manquant)", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const placed = await api.post("/api/orders").send(orderBody()).expect(201);
    const order = await agent.get(`/api/admin/orders/${placed.body.eventId}`).expect(200);
    expect(order.body.order.unitCost).toBeNull();
  });

  it("copies packaging and return costs when an order becomes delivered or returned", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    await agent
      .put("/api/admin/settings")
      .send({ packagingCost: 150, returnCost: 600 })
      .expect(200);
    const step = (id: string, status: string) =>
      agent.post(`/api/admin/orders/${id}/status`).send({ status }).expect(200);

    const first = (await api.post("/api/orders").send(orderBody()).expect(201)).body.eventId;
    for (const status of ["confirmed", "shipped", "delivered"]) await step(first, status);
    const second = (
      await api
        .post("/api/orders")
        .send(orderBody({ phone: "0661 22 33 44", productId: "prod_001" }))
        .expect(201)
    ).body.eventId;
    for (const status of ["confirmed", "shipped"]) await step(second, status);

    // New values from now on: the delivered order keeps 150 DA.
    await agent
      .put("/api/admin/settings")
      .send({ packagingCost: 300, returnCost: 700 })
      .expect(200);
    const returned = await step(second, "returned");
    expect(returned.body.order.costs).toEqual({ packaging: 300, returnCost: 700 });
    const delivered = await agent.get(`/api/admin/orders/${first}`).expect(200);
    expect(delivered.body.order.costs).toEqual({ packaging: 150, returnCost: null });

    // Delivered then returned: the packaging copied at delivery is kept.
    const back = await step(first, "returned");
    expect(back.body.order.costs).toEqual({ packaging: 150, returnCost: 700 });
  });

  it("validates the settings with French errors", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    const bad = await agent.put("/api/admin/settings").send({ packagingCost: -5 }).expect(400);
    expect(bad.body.error.fields.packagingCost).toBe(
      "Le coût d'emballage ne peut pas être négatif.",
    );
    const decimal = await agent.put("/api/admin/settings").send({ returnCost: 12.5 }).expect(400);
    expect(decimal.body.error.fields.returnCost).toBe(
      "Indiquez le coût d'un retour en DA, sans centimes.",
    );
    // Partial update: the other settings are kept.
    await agent.put("/api/admin/settings").send({ lowStockThreshold: 4 }).expect(200);
    const saved = await agent.put("/api/admin/settings").send({ packagingCost: 90 }).expect(200);
    expect(saved.body).toEqual({ lowStockThreshold: 4, packagingCost: 90, returnCost: 0 });
  });

  it("saves only the threshold, or only the costs, without touching the rest", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await agent
      .put("/api/admin/settings")
      .send({ lowStockThreshold: 10, packagingCost: 150, returnCost: 600 })
      .expect(200);
    // The stock threshold dialog sends the threshold alone.
    const threshold = await agent.put("/api/admin/settings").send({ lowStockThreshold: 20 });
    expect(threshold.status).toBe(200);
    expect(threshold.body).toEqual({ lowStockThreshold: 20, packagingCost: 150, returnCost: 600 });
    // The costs alone, including 0 (a real value, not "missing").
    const costs = await agent.put("/api/admin/settings").send({ packagingCost: 0, returnCost: 0 });
    expect(costs.status).toBe(200);
    expect(costs.body).toEqual({ lowStockThreshold: 20, packagingCost: 0, returnCost: 0 });
    // An invalid field is reported under its own key and nothing else changes.
    const bad = await agent
      .put("/api/admin/settings")
      .send({ lowStockThreshold: 30, returnCost: -1 })
      .expect(400);
    expect(Object.keys(bad.body.error.fields)).toEqual(["returnCost"]);
    expect((await agent.get("/api/admin/settings").expect(200)).body.lowStockThreshold).toBe(20);
    // An empty update is refused in French.
    const empty = await agent.put("/api/admin/settings").send({}).expect(400);
    expect(empty.body.error.message).toBe("Rien à modifier.");
  });
});

describe("admin insights: tableau de bord", () => {
  it("computes revenue, profit, margin and missing costs from the stored orders", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await marchData();
    const { body } = await agent.get(`/api/admin/stats?${MARCH}`).expect(200);

    expect(body.range).toMatchObject({
      from: "2026-03-01",
      to: "2026-03-31",
      previousFrom: "2026-01-29",
      previousTo: "2026-02-28",
      granularity: "day",
      hasPrevious: true,
    });
    expect(body.kpis.orders.value).toBe(7);
    // Encaissé = articles of the delivered orders (A 7 000 + B 14 000).
    expect(body.kpis.revenue.value).toBe(21_000);
    // En attente = confirmed (5 000) + shipped (6 000).
    expect(body.kpis.pendingRevenue).toBe(11_000);
    // A: 7 000 − 3 000 − 100 − 150 = 3 750. B (no cost): 14 000 − 0 − 400 − 200 = 13 400.
    // C returned: −(600 + 150) = −750. Ads in March: 6 days × 300 + 1 000 = 2 800.
    expect(body.kpis.profit.value).toBe(3750 + 13_400 - 750 - 2800);
    expect(body.kpis.margin).toBeCloseTo(13_600 / 21_000, 10);
    expect(body.missingCosts).toBe(1);
    expect(body.kpis.clients.value).toBe(6);
    expect(body.statuses).toEqual({
      pending: 1,
      confirmed: 1,
      shipped: 1,
      delivered: 2,
      cancelled: 1,
      returned: 1,
    });
    expect(body.settings).toEqual({ packagingCost: 200, returnCost: 500 });
  });

  it("compares with the previous period of the same length", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await marchData();
    const { body } = await agent.get(`/api/admin/stats?${MARCH}`).expect(200);
    // Previous: 1 order, 5 000 DA encaissés, profit 5 000 − 2 000 − 150 − ads 4 × 300 = 1 650.
    expect(body.kpis.orders).toMatchObject({ previous: 1, trend: 600 });
    expect(body.kpis.revenue).toMatchObject({ previous: 5000, trend: 320 });
    expect(body.kpis.profit).toMatchObject({ previous: 1650, trend: 724.2 });
    expect(body.kpis.clients).toMatchObject({ previous: 1, trend: 500 });
  });

  it("hides every trend when the previous period has no orders", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await insertOrder({
      status: "delivered",
      at: "2026-05-10T10:00:00+01:00",
      phone: "0550000009",
    });
    const { body } = await agent.get("/api/admin/stats?from=2026-05-01&to=2026-05-31").expect(200);
    expect(body.range.hasPrevious).toBe(false);
    for (const kpi of ["orders", "revenue", "profit", "clients"]) {
      expect(body.kpis[kpi].trend, kpi).toBeNull();
      expect(body.kpis[kpi].previous, kpi).toBeNull();
    }
  });

  it("gives the sales chart one point per day, ads spend included in the profit", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await marchData();
    const { body } = await agent.get(`/api/admin/stats?${MARCH}`).expect(200);
    expect(body.series).toHaveLength(31);
    const day = (date: string) =>
      body.series.find((point: { start: string }) => point.start === date);
    expect(day("2026-03-02")).toEqual({
      start: "2026-03-02",
      orders: 1,
      revenue: 7000,
      profit: 3450,
    });
    expect(day("2026-03-15")).toEqual({
      start: "2026-03-15",
      orders: 0,
      revenue: 0,
      profit: -1000,
    });
    expect(day("2026-03-07")).toEqual({ start: "2026-03-07", orders: 0, revenue: 0, profit: 0 });
    const sum = body.series.reduce(
      (total: number, point: { profit: number }) => total + point.profit,
      0,
    );
    expect(sum).toBe(body.kpis.profit.value);
    expect(body.kpis.orders.series).toHaveLength(31);
  });

  it("uses weeks for a quarter and months for a year", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await marchData();
    const quarter = await agent.get("/api/admin/stats?from=2026-01-01&to=2026-03-31").expect(200);
    expect(quarter.body.range.granularity).toBe("week");
    // Weeks start on Monday: 29 Dec 2025 is the Monday of 1 Jan 2026.
    expect(quarter.body.series[0].start).toBe("2025-12-29");
    const year = await agent.get("/api/admin/stats?from=2026-01-01&to=2026-12-31").expect(200);
    expect(year.body.range.granularity).toBe("month");
    expect(year.body.series.map((point: { start: string }) => point.start)).toHaveLength(12);
    const march = year.body.series.find((point: { start: string }) => point.start === "2026-03-01");
    expect(march).toMatchObject({ orders: 7, revenue: 21_000 });
  });

  it("counts orders by their day in Algeria (UTC+1)", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await insertOrder({ status: "pending", at: "2026-04-01T00:10:00+01:00", phone: "0550000011" });
    await insertOrder({ status: "pending", at: "2026-03-31T23:50:00+01:00", phone: "0550000012" });
    const { body } = await agent.get("/api/admin/stats?from=2026-04-01&to=2026-04-01").expect(200);
    expect(body.kpis.orders.value).toBe(1);
    expect(body.range).toMatchObject({ previousFrom: "2026-03-31", previousTo: "2026-03-31" });
    expect(body.kpis.orders.previous).toBe(1);
  });

  it("computes the confirmation and delivery rates, returns and discounts", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await marchData();
    const { body } = await agent.get(`/api/admin/stats?${MARCH}`).expect(200);
    // Processed = every order except pending (6); confirmed or later = 5 (the cancelled order
    // has no "confirmed" step in its history).
    expect(body.performance.confirmationRate).toEqual({
      value: 5 / 6,
      numerator: 5,
      denominator: 6,
    });
    expect(body.performance.cancelledAfterConfirmation).toBe(0);
    // Delivered ÷ (delivered + returned) = 2 ÷ 3.
    expect(body.performance.deliveryRate).toEqual({ value: 2 / 3, numerator: 2, denominator: 3 });
    expect(body.performance.returns).toEqual({ count: 1, cost: 750 });
    expect(body.performance.discounts).toEqual({ total: 500, freeDeliveryOrders: 1 });
    expect(body.performance.topWilayas).toEqual([
      { code: 16, orders: 3 },
      { code: 31, orders: 2 },
      { code: 6, orders: 1 },
      { code: 9, orders: 1 },
    ]);
  });

  it("counts every order ever confirmed, even when cancelled or returned since", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const place = async (phone: string) =>
      (await api.post("/api/orders").send(orderBody({ phone })).expect(201)).body.eventId as string;
    const steps = async (id: string, statuses: string[]) => {
      for (const status of statuses) {
        await agent.post(`/api/admin/orders/${id}/status`).send({ status }).expect(200);
      }
    };
    // Confirmed then cancelled, cancelled without a call, returned, delivered, still new,
    // and cancelled after confirmation then reopened (pending again: not counted).
    await steps(await place("0661 22 33 41"), ["confirmed", "cancelled"]);
    await steps(await place("0661 22 33 42"), ["cancelled"]);
    await steps(await place("0661 22 33 43"), ["confirmed", "shipped", "returned"]);
    await steps(await place("0661 22 33 44"), ["confirmed", "shipped", "delivered"]);
    await place("0661 22 33 45");
    await steps(await place("0661 22 33 46"), ["confirmed", "cancelled", "pending"]);

    const { body } = await agent.get("/api/admin/stats").expect(200);
    // Processed = 4 (two pending left out); ever confirmed = 3 of them.
    expect(body.performance.confirmationRate).toEqual({
      value: 3 / 4,
      numerator: 3,
      denominator: 4,
    });
    expect(body.performance.cancelledAfterConfirmation).toBe(1);
  });

  it("ranks the best sellers by units with their profit and current stock", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await marchData();
    const { body } = await agent.get(`/api/admin/stats?${MARCH}`).expect(200);
    // Confirmed, shipped and delivered only: Fragment Noir 3 units (A + B), Signature Noir 2.
    expect(body.topProducts).toEqual([
      expect.objectContaining({
        productId: "prod_003",
        color: "Noir",
        units: 3,
        // B has no cost price: the profit of this product is unknown.
        profit: null,
        stock: 33,
      }),
      expect.objectContaining({
        productId: "prod_001",
        color: "Noir",
        units: 2,
        profit: 0,
        stock: 44,
      }),
    ]);

    // Once B has a cost, the profit is A + B: 3 750 + (14 000 − 2 × 3 000 − 400 − 200).
    await OrderModel.updateOne({ phone: "0550000002" }, { $set: { "item.unitCost": 3000 } });
    const fixed = await agent.get(`/api/admin/stats?${MARCH}`).expect(200);
    expect(fixed.body.topProducts[0].profit).toBe(3750 + 7400);
    expect(fixed.body.missingCosts).toBe(0);
  });

  it("gives the ads figures, the latest orders and the bottom cards", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await marchData();
    const { body } = await agent.get(`/api/admin/stats?${MARCH}`).expect(200);
    expect(body.ads).toEqual({
      spend: 2800,
      orders: 7,
      deliveredOrders: 2,
      revenue: 21_000,
      costPerOrder: 400,
      costPerDeliveredOrder: 1400,
      roas: 7.5,
    });
    expect(body.latestOrders).toHaveLength(5);
    expect(body.latestOrders[0]).toMatchObject({ status: "cancelled", total: 5400 });
    // 7 phones in all (6 in March + 1 in February).
    expect(body.clientsTotal).toBe(7);
    expect(body.stock).toEqual({ lowStockProducts: 0, threshold: 10 });
  });

  it("refuses an invalid range with a French error", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    const reversed = await agent.get("/api/admin/stats?from=2026-03-10&to=2026-03-01").expect(400);
    expect(reversed.body.error.fields.from).toBe("La date de début doit précéder la date de fin.");
    // No range: the last 30 days.
    const fallback = await agent.get("/api/admin/stats").expect(200);
    expect(fallback.body.series).toHaveLength(30);
  });
});

describe("admin insights: ads spend", () => {
  it("adds, lists, edits and deletes entries, with the figures of the range", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await marchData();
    await AdSpendModel.deleteMany({});

    const bad = await agent
      .post("/api/admin/ads")
      .send({ startDate: "2026-03-10", endDate: "2026-03-01", amount: 1000 })
      .expect(400);
    expect(bad.body.error.fields.endDate).toBe(
      "La date de fin doit être le même jour ou après la date de début.",
    );
    const zero = await agent
      .post("/api/admin/ads")
      .send({ startDate: "2026-03-01", endDate: "2026-03-01", amount: 0 })
      .expect(400);
    expect(zero.body.error.fields.amount).toBe("Le montant doit être supérieur à 0 DA.");

    const created = await agent
      .post("/api/admin/ads")
      .send({ startDate: "2026-03-01", endDate: "2026-03-10", amount: 7000, note: "Drop 001" })
      .expect(201);
    expect(created.body.entry).toMatchObject({ amount: 7000, note: "Drop 001" });

    const page = await agent.get(`/api/admin/ads?${MARCH}`).expect(200);
    expect(page.body.entries).toHaveLength(1);
    expect(page.body.summary).toEqual({
      spend: 7000,
      orders: 7,
      deliveredOrders: 2,
      revenue: 21_000,
      costPerOrder: 1000,
      costPerDeliveredOrder: 3500,
      roas: 3,
    });
    // Half the period in the range: half the spend (spread evenly per day).
    const half = await agent.get("/api/admin/ads?from=2026-03-06&to=2026-03-31").expect(200);
    expect(half.body.summary.spend).toBe(3500);

    const id = created.body.entry.id;
    await agent
      .put(`/api/admin/ads/${id}`)
      .send({ startDate: "2026-03-01", endDate: "2026-03-01", amount: 2100, note: "" })
      .expect(200);
    const edited = await agent.get(`/api/admin/ads?${MARCH}`).expect(200);
    expect(edited.body.summary).toMatchObject({ spend: 2100, costPerOrder: 300, roas: 10 });

    await agent.delete(`/api/admin/ads/${id}`).expect(200);
    await agent.delete(`/api/admin/ads/${id}`).expect(404);
    const empty = await agent.get(`/api/admin/ads?${MARCH}`).expect(200);
    expect(empty.body.summary).toMatchObject({
      spend: 0,
      costPerOrder: null,
      costPerDeliveredOrder: null,
      roas: null,
    });
  });
});

describe("admin insights: clients", () => {
  it("groups orders by phone with badges, filters, search, sort and CSV", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    const loyal = "0661111111";
    for (const [index, status] of (
      ["delivered", "delivered", "delivered", "returned"] as const
    ).entries()) {
      await insertOrder({
        status,
        at: `2026-03-0${index + 1}T10:00:00+01:00`,
        phone: loyal,
        fullName: index === 3 ? "Amine Kaci" : "Amine K.",
        wilaya: index === 3 ? 31 : 16,
      });
    }
    await insertOrder({
      status: "pending",
      at: "2026-03-08T10:00:00+01:00",
      phone: "0772222222",
      fullName: "Sara Mansouri",
    });
    await BlacklistModel.create({ phone: "0772222222", reason: "Colis refusé" });

    const all = await agent.get("/api/admin/clients").expect(200);
    expect(all.body.total).toBe(2);
    const amine = all.body.clients.find((client: { phone: string }) => client.phone === loyal);
    expect(amine).toMatchObject({
      // Name and wilaya of the latest order.
      name: "Amine Kaci",
      wilayaCode: 31,
      orders: 4,
      delivered: 3,
      returned: 1,
      // Totals of the delivered orders (7 000 + 400 delivery each).
      spent: 3 * 7400,
      badges: ["loyal", "risk"],
    });
    expect(all.body.clients[0].phone).toBe("0772222222"); // latest order first

    const blacklisted = await agent.get("/api/admin/clients?badge=blacklist").expect(200);
    expect(blacklisted.body.clients.map((client: { name: string }) => client.name)).toEqual([
      "Sara Mansouri",
    ]);
    expect((await agent.get("/api/admin/clients?badge=loyal").expect(200)).body.total).toBe(1);
    expect((await agent.get("/api/admin/clients?badge=risk").expect(200)).body.total).toBe(1);
    expect((await agent.get("/api/admin/clients?wilaya=16").expect(200)).body.total).toBe(1);
    expect((await agent.get("/api/admin/clients?q=0661 11").expect(200)).body.total).toBe(1);
    expect((await agent.get("/api/admin/clients?q=sara").expect(200)).body.total).toBe(1);
    const bySpent = await agent.get("/api/admin/clients?sort=spent").expect(200);
    expect(bySpent.body.clients[0].phone).toBe(loyal);

    const csv = await agent.get("/api/admin/clients/export?sort=name").expect(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    const lines = csv.text
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");
    expect(lines[0]).toBe(
      "Nom;Téléphone;Wilaya;Commandes;Livrées;Retournées;Total dépensé (DA);Première commande;Dernière commande;Badges",
    );
    expect(lines[1]).toBe(
      "Amine Kaci;0661 11 11 11;31 - Oran;4;3;1;22200;2026-03-01;2026-03-04;Fidèle, À risque",
    );

    const detail = await agent.get(`/api/admin/clients/${loyal}`).expect(200);
    expect(detail.body.orders).toHaveLength(4);
    expect(detail.body.blacklist).toBeNull();
    const sara = await agent.get("/api/admin/clients/0772222222").expect(200);
    expect(sara.body.blacklist).toMatchObject({ reason: "Colis refusé" });
    await agent.get("/api/admin/clients/0700000000").expect(404);
  });

  it("finds clients from the global search", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await insertOrder({
      status: "pending",
      at: "2026-03-08T10:00:00+01:00",
      phone: "0772222222",
      fullName: "Sara Mansouri",
    });
    const found = await agent.get("/api/admin/search?q=mans").expect(200);
    expect(found.body.clients).toEqual([{ phone: "0772222222", name: "Sara Mansouri", orders: 1 }]);
  });
});

describe("admin insights: messages", () => {
  const message = {
    firstName: "Nadia",
    lastName: "Saidi",
    phone: "0555 12 34 56",
    email: "nadia@example.com",
    subject: "exchange",
    message: "Bonjour, je voudrais échanger ma taille M contre une L.",
  };

  it("e-mails the team, counts unread, marks read, archives and deletes", async () => {
    const { app, api, messageNotifier } = testApp();
    const agent = await adminAgent(app);
    await api.post("/api/contact-messages").send(message).expect(201);
    await vi.waitFor(() => expect(messageNotifier.notifyNewMessage).toHaveBeenCalledTimes(1));
    expect(messageNotifier.notifyNewMessage.mock.calls[0]?.[0]).toMatchObject({
      firstName: "Nadia",
      phone: "0555123456",
    });
    // Honeypot: nothing saved, no e-mail.
    await api
      .post("/api/contact-messages")
      .send({ ...message, website: "spam" })
      .expect(201);
    expect(messageNotifier.notifyNewMessage).toHaveBeenCalledTimes(1);

    const unread = async () =>
      (await agent.get("/api/admin/orders/updates").expect(200)).body.unreadMessages;
    expect(await unread()).toBe(1);

    const list = await agent.get("/api/admin/messages?folder=unread").expect(200);
    expect(list.body.counts).toEqual({ inbox: 1, unread: 1, read: 0, archived: 0 });
    const id = list.body.messages[0].id;
    expect(list.body.messages[0]).toMatchObject({
      subject: "exchange",
      read: false,
      email: "nadia@example.com",
    });

    // Opening it marks it read.
    const opened = await agent.get(`/api/admin/messages/${id}`).expect(200);
    expect(opened.body.message.read).toBe(true);
    expect(await unread()).toBe(0);
    await agent.patch(`/api/admin/messages/${id}`).send({ read: false }).expect(200);
    expect(await unread()).toBe(1);

    await agent.patch(`/api/admin/messages/${id}`).send({ archived: true }).expect(200);
    const after = await agent.get("/api/admin/messages").expect(200);
    expect(after.body.messages).toHaveLength(0);
    expect(after.body.counts).toEqual({ inbox: 0, unread: 0, read: 0, archived: 1 });
    // Archived messages are not counted as unread.
    expect(await unread()).toBe(0);

    expect(
      (await agent.get("/api/admin/messages?folder=archived&q=taille").expect(200)).body.total,
    ).toBe(1);
    expect(
      (await agent.get("/api/admin/messages?folder=archived&subject=order").expect(200)).body.total,
    ).toBe(0);

    await agent.patch(`/api/admin/messages/${id}`).send({}).expect(400);
    await agent.delete(`/api/admin/messages/${id}`).expect(200);
    await agent.get(`/api/admin/messages/${id}`).expect(404);
    expect(await ContactMessageModel.countDocuments()).toBe(0);
  });

  it("builds the French message e-mail with the text escaped", () => {
    const email = buildNewMessageEmail(
      {
        _id: "6720f0000000000000000001" as never,
        firstName: "Nadia",
        lastName: "<b>Saidi</b>",
        phone: "0555123456",
        email: undefined,
        subject: "order",
        message: "Où est ma commande ?",
      },
      "https://rassm.dz/admin",
    );
    expect(email.subject).toBe("Nouveau message (Commande) : Nadia <b>Saidi</b>");
    expect(email.html).toContain("&lt;b&gt;Saidi&lt;/b&gt;");
    expect(email.html).toContain("https://rassm.dz/admin/messages/6720f0000000000000000001");
    expect(email.text).toContain("Téléphone : 0555 12 34 56");
    expect(email.text).not.toContain("E-mail");
  });
});

describe("admin insights: newsletter subscribers", () => {
  type Api = ReturnType<typeof testApp>["api"];
  type List = ReturnType<typeof fakeNewsletterList>;

  /** The token of the last confirmation e-mail sent. */
  async function lastConfirmationToken(newsletterList: List, calls = 1) {
    await vi.waitFor(() =>
      expect(newsletterList.sendConfirmation.mock.calls.length).toBeGreaterThanOrEqual(calls),
    );
    const link = newsletterList.sendConfirmation.mock.calls.at(-1)?.[1] ?? "";
    return link.split("#jeton=")[1] ?? "";
  }

  /** A sign-up, then a click on the link of the confirmation e-mail (double opt-in). */
  async function signUpAndConfirm(api: Api, newsletterList: List, email: string) {
    await api.post("/api/newsletter").send({ elapsedMs: 9000, email }).expect(201);
    const token = await lastConfirmationToken(newsletterList);
    await api.post("/api/newsletter/confirm").send({ token }).expect(200);
  }

  it("double opt-in: confirmation e-mail first, the Brevo list only after the link", async () => {
    const newsletterList = fakeNewsletterList();
    const { app, api } = testApp({ newsletterList });
    const agent = await adminAgent(app);
    await api
      .post("/api/newsletter")
      .send({ elapsedMs: 9000, email: "Lina@Example.com" })
      .expect(201);
    await vi.waitFor(() =>
      expect(newsletterList.sendConfirmation).toHaveBeenCalledWith(
        "lina@example.com",
        expect.stringMatching(
          /^http:\/\/localhost:3000\/newsletter\/confirmation#jeton=[\w-]{43}$/,
        ),
      ),
    );
    const token = await lastConfirmationToken(newsletterList);
    // Only the hash of the token is kept; not in the list before the click.
    const stored = await NewsletterSubscriberModel.findOne().lean();
    expect(stored?.confirmationPending?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(newsletterList.add).not.toHaveBeenCalled();
    const pending = await agent.get("/api/admin/subscribers").expect(200);
    expect(pending.body.subscribers[0].sync.status).toBe("unconfirmed");
    // Signing up again within the hour: no second e-mail, same answer.
    await api
      .post("/api/newsletter")
      .send({ elapsedMs: 9000, email: "lina@example.com" })
      .expect(201);
    expect(newsletterList.sendConfirmation).toHaveBeenCalledTimes(1);

    await api.post("/api/newsletter/confirm").send({ token }).expect(200);
    await vi.waitFor(() => expect(newsletterList.add).toHaveBeenCalledWith("lina@example.com"));
    // The link works once.
    const again = await api.post("/api/newsletter/confirm").send({ token }).expect(400);
    expect(again.body.error.message).toMatch(/^Ce lien de confirmation n'est plus valable/);
    await api
      .post("/api/newsletter/confirm")
      .send({ token: "x".repeat(43) })
      .expect(400);
    expect(newsletterList.add).toHaveBeenCalledTimes(1);

    await vi.waitFor(async () => {
      const list = await agent.get("/api/admin/subscribers").expect(200);
      expect(list.body.subscribers[0].sync.status).toBe("synced");
    });
    const list = await agent.get("/api/admin/subscribers").expect(200);
    expect(list.body).toMatchObject({ total: 1, brevoConfigured: true });

    const csv = await agent.get("/api/admin/subscribers/export").expect(200);
    expect(csv.text.replace(/^\uFEFF/, "").split("\r\n")[0]).toBe(
      "E-mail;Inscription;Adresse confirm\u00E9e",
    );
    expect(csv.text).toMatch(/lina@example\.com;[\d-]+;Oui/);

    const id = list.body.subscribers[0].id;
    await agent.delete(`/api/admin/subscribers/${id}`).expect(200);
    await vi.waitFor(() => expect(newsletterList.remove).toHaveBeenCalledWith("lina@example.com"));
    expect(await NewsletterSubscriberModel.countDocuments()).toBe(0);
    await agent.delete(`/api/admin/subscribers/${id}`).expect(404);
  });

  it("shows a Brevo failure as « En erreur » and lets the team retry", async () => {
    const newsletterList = fakeNewsletterList();
    newsletterList.add.mockRejectedValueOnce(new Error("Brevo answered 401: unauthorized"));
    const { app, api } = testApp({ newsletterList });
    const agent = await adminAgent(app);
    // The sign-up and the confirmation never fail.
    await signUpAndConfirm(api, newsletterList, "omar@example.com");
    await vi.waitFor(async () => {
      const list = await agent.get("/api/admin/subscribers?sync=failed").expect(200);
      expect(list.body.subscribers[0]?.sync).toMatchObject({
        status: "failed",
        error: "Clé Brevo refusée.",
      });
    });
    const id = (await agent.get("/api/admin/subscribers").expect(200)).body.subscribers[0].id;
    const retried = await agent.post(`/api/admin/subscribers/${id}/sync`).expect(200);
    expect(retried.body.subscriber.sync).toMatchObject({ status: "synced", error: null });
    expect(newsletterList.add).toHaveBeenCalledTimes(2);
  });

  it("« Renvoyer l'e-mail » sends a new confirmation link, never adds an unconfirmed address", async () => {
    const newsletterList = fakeNewsletterList();
    const { app, api } = testApp({ newsletterList });
    const agent = await adminAgent(app);
    await api.post("/api/newsletter").send({ elapsedMs: 9000, email: "nadia@example.com" });
    const first = await lastConfirmationToken(newsletterList);
    const id = (await agent.get("/api/admin/subscribers").expect(200)).body.subscribers[0].id;
    const resent = await agent.post(`/api/admin/subscribers/${id}/sync`).expect(200);
    expect(resent.body.subscriber.sync.status).toBe("unconfirmed");
    const second = await lastConfirmationToken(newsletterList, 2);
    expect(second).not.toBe(first);
    expect(newsletterList.add).not.toHaveBeenCalled();
    // Only the latest link works.
    await api.post("/api/newsletter/confirm").send({ token: first }).expect(400);
    await api.post("/api/newsletter/confirm").send({ token: second }).expect(200);
    await vi.waitFor(() => expect(newsletterList.add).toHaveBeenCalledWith("nadia@example.com"));
  });

  it("keeps sign-ups on the site when the Brevo list is not configured", async () => {
    const newsletterList = fakeNewsletterList(false);
    const { app, api } = testApp({ newsletterList });
    const agent = await adminAgent(app);
    await api
      .post("/api/newsletter")
      .send({ elapsedMs: 9000, email: "sami@example.com" })
      .expect(201);
    const list = await agent.get("/api/admin/subscribers").expect(200);
    expect(list.body).toMatchObject({ total: 1, brevoConfigured: false });
    expect(list.body.subscribers[0].sync.status).toBe("off");
    expect(newsletterList.add).not.toHaveBeenCalled();
    const id = list.body.subscribers[0].id;
    const retry = await agent.post(`/api/admin/subscribers/${id}/sync`).expect(503);
    expect(retry.body.error.message).toMatch(/BREVO_NEWSLETTER_LIST_ID/);
  });

  it("calls the Brevo contacts API with the list id", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const list = createBrevoNewsletterList({
      apiKey: "brevo-test-key-0123456789",
      listId: 7,
      from: "equipe@rassm.test",
    });
    await list.add("lina@example.com");
    await list.remove("lina@example.com");
    const [addUrl, addInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(addUrl).toBe("https://api.brevo.com/v3/contacts");
    expect(JSON.parse(String(addInit.body))).toEqual({
      email: "lina@example.com",
      listIds: [7],
      updateEnabled: true,
    });
    expect((addInit.headers as Record<string, string>)["api-key"]).toBe(
      "brevo-test-key-0123456789",
    );
    const [removeUrl, removeInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(removeUrl).toBe("https://api.brevo.com/v3/contacts/lists/7/contacts/remove");
    expect(JSON.parse(String(removeInit.body))).toEqual({ emails: ["lina@example.com"] });

    // Not in the list any more: removing it is not an error.
    fetchMock.mockResolvedValueOnce(new Response('{"code":"invalid_parameter"}', { status: 400 }));
    await expect(list.remove("gone@example.com")).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(new Response("down", { status: 500 }));
    await expect(list.add("x@example.com")).rejects.toThrow("Brevo answered 500");
  });
});

describe("admin insights: test orders", () => {
  it("stay in the orders list (filterable) but out of statistics, clients and exports", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    await marchData();
    const before = (await agent.get(`/api/admin/stats?${MARCH}`).expect(200)).body;
    const clientsBefore = (await agent.get("/api/admin/clients").expect(200)).body.total;

    const test = await insertOrder({
      status: "delivered",
      at: "2026-03-10T10:00:00Z",
      phone: "0555999999",
      fullName: "Commande Test",
      unitPrice: 9000,
    });
    await OrderModel.collection.updateOne({ _id: test._id }, { $set: { test: true } });
    const confirmed = await insertOrder({
      status: "confirmed",
      at: "2026-03-10T11:00:00Z",
      phone: "0555999998",
    });
    await OrderModel.collection.updateOne({ _id: confirmed._id }, { $set: { test: true } });

    // Statistics are unchanged.
    const after = (await agent.get(`/api/admin/stats?${MARCH}`).expect(200)).body;
    expect(after.kpis).toEqual(before.kpis);
    expect(after.performance).toEqual(before.performance);
    expect(after.latestOrders).toEqual(before.latestOrders);
    expect(after.bestSellers).toEqual(before.bestSellers);
    expect(after.clientsTotal ?? after.kpis.clients).toEqual(
      before.clientsTotal ?? before.kpis.clients,
    );

    // Clients (list, detail, search, CSV) never see them.
    expect((await agent.get("/api/admin/clients").expect(200)).body.total).toBe(clientsBefore);
    await agent.get("/api/admin/clients/0555999999").expect(404);
    const csv = await agent.get("/api/admin/clients/export").expect(200);
    expect(csv.text).not.toContain("Commande Test");
    const found = await agent.get("/api/admin/search?q=Commande%20Test").expect(200);
    expect(found.body.clients).toEqual([]);

    // The Anderson export skips them.
    const exported = await agent
      .post("/api/admin/orders/export")
      .send({ ids: [String(confirmed._id)] })
      .expect(400);
    expect(exported.body.error.message).toBe("Aucune commande confirmée à exporter.");

    // Still in the orders list, with the grey pill data, and a filter for them only.
    const all = await agent.get("/api/admin/orders?status=all&limit=100").expect(200);
    expect(all.body.orders.filter((order: { test: boolean }) => order.test)).toHaveLength(2);
    const only = await agent.get("/api/admin/orders?status=all&tests=1").expect(200);
    expect(only.body.orders).toHaveLength(2);
    expect(only.body.orders.every((order: { test: boolean }) => order.test)).toBe(true);
    expect(only.body.counts.all).toBe(2);
  });
});
