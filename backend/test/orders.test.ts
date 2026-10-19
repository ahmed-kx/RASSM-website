import { placedOrderSchema } from "@rassm/shared";
import { describe, expect, it } from "vitest";
import { CounterModel } from "../src/models/counter";
import { OrderModel } from "../src/models/order";
import { ProductModel } from "../src/models/product";
import { orderBody, testApp } from "./helpers";

async function stockOf(productId: string, color: string, size: "S" | "M" | "L" | "XL" | "XXL") {
  const product = await ProductModel.findById(productId).lean();
  return product?.colors.find((c) => c.name === color)?.stock[size];
}

describe("POST /api/orders: server-side pricing", () => {
  it.each([
    { quantity: 1, subtotal: 6900, discount: 100, fee: 300, free: false, total: 7200 },
    { quantity: 2, subtotal: 13800, discount: 200, fee: 200, free: false, total: 14000 },
    { quantity: 3, subtotal: 20700, discount: 400, fee: 0, free: true, total: 20700 },
  ])(
    "prices $quantity Fragment Sweatshirt(s) at home in Alger from the database (discount tiers)",
    async ({ quantity, subtotal, discount, fee, free, total }) => {
      const { api } = testApp();
      const res = await api.post("/api/orders").send(orderBody({ quantity })).expect(201);

      const placed = placedOrderSchema.parse(res.body);
      expect(placed.order).toMatchObject({
        item: { productId: "prod_003", color: "Noir", size: "M", quantity, unitPrice: 6900 },
        subtotal,
        deliveryFeeBase: 400,
        deliveryDiscount: discount,
        deliveryFee: fee,
        freeDelivery: free,
        total,
        status: "pending",
        phone: "0555123456",
      });
      // The customer never receives the internal order number.
      expect(JSON.stringify(res.body)).not.toMatch(/RSM-\d/);

      const saved = await OrderModel.findById(placed.eventId).lean();
      expect(saved).toMatchObject({ status: "pending", total, orderNumber: "RSM-000001" });
    },
  );

  it("ignores any price, discount or total sent by the client", async () => {
    const { api } = testApp();
    const res = await api
      .post("/api/orders")
      .send({
        ...orderBody({ unitPrice: 1, price: 1, total: 1, deliveryFee: 0 } as Record<
          string,
          unknown
        >),
        total: 1,
        deliveryFee: 0,
        subtotal: 1,
      })
      .expect(201);
    expect(res.body.order).toMatchObject({ subtotal: 6900, deliveryFee: 300, total: 7200 });
    expect(res.body.order.item.unitPrice).toBe(6900);
  });

  it("uses the stop desk price", async () => {
    const { api } = testApp();
    const res = await api
      .post("/api/orders")
      .send(orderBody({ deliveryType: "stopdesk", address: "" }))
      .expect(201);
    expect(res.body.order).toMatchObject({ deliveryFeeBase: 250, deliveryFee: 150, total: 7050 });
  });

  it("refuses stop desk in Tindouf, in French, under the delivery type", async () => {
    const { api } = testApp();
    const res = await api
      .post("/api/orders")
      .send(orderBody({ wilayaCode: 37, deliveryType: "stopdesk" }))
      .expect(400);
    expect(res.body.error.fields.deliveryType).toBe(
      "La livraison au bureau (stop desk) n'est pas disponible dans la wilaya de Tindouf. Choisissez la livraison à domicile.",
    );
    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("returns French validation errors per field", async () => {
    const { api } = testApp();
    const res = await api
      .post("/api/orders")
      .send(orderBody({ phone: "123", fullName: "", address: "", size: "XXXL" as "M" }))
      .expect(400);
    expect(res.body.error.message).toBe(
      "Certains champs sont invalides : vérifiez les messages indiqués.",
    );
    expect(res.body.error.fields).toMatchObject({
      phone: expect.stringContaining("Numéro invalide"),
      fullName: "Veuillez entrer votre nom complet (3 caractères minimum).",
      size: "Veuillez choisir une taille.",
    });
  });

  it("refuses an unknown product and a sold-out variant, in French", async () => {
    const { api } = testApp();
    const unknown = await api.post("/api/orders").send(orderBody({ productId: "prod_999" }));
    expect(unknown.status).toBe(409);
    expect(unknown.body.error.message).toBe("Ce produit n'est plus disponible.");

    // Classic Tee: Crème M is sold out.
    const soldOut = await api
      .post("/api/orders")
      .send(orderBody({ productId: "prod_005", color: "Crème", size: "M" }))
      .expect(400);
    expect(soldOut.body.error.fields.size).toBe("La taille M est épuisée en Crème.");
  });
});

describe("POST /api/orders: stock", () => {
  it("decrements the stock of the ordered color + size only", async () => {
    const { api } = testApp();
    const before = await stockOf("prod_005", "Crème", "L");
    const otherBefore = await stockOf("prod_005", "Noir", "L");
    await api
      .post("/api/orders")
      .send(orderBody({ productId: "prod_005", color: "Crème", size: "L", quantity: 2 }))
      .expect(201);
    expect(await stockOf("prod_005", "Crème", "L")).toBe((before ?? 0) - 2);
    expect(await stockOf("prod_005", "Noir", "L")).toBe(otherBefore);
  });

  it("sells the last unit once when two orders arrive at the same time", async () => {
    await ProductModel.updateOne(
      { _id: "prod_003", "colors.name": "Noir" },
      { $set: { "colors.$.stock.M": 1 } },
    );
    const { api } = testApp();
    const [first, second] = await Promise.all([
      api.post("/api/orders").send(orderBody({ phone: "0555000001" })),
      api.post("/api/orders").send(orderBody({ phone: "0666000002" })),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const refused = first.status === 409 ? first : second;
    expect(refused.body.error.fields.size).toBe("La taille M est épuisée en Noir.");
    expect(await stockOf("prod_003", "Noir", "M")).toBe(0);
    expect(await OrderModel.countDocuments()).toBe(1);
  });

  it("explains how many are left when the quantity is too high", async () => {
    await ProductModel.updateOne(
      { _id: "prod_003", "colors.name": "Noir" },
      { $set: { "colors.$.stock.M": 2 } },
    );
    const { api } = testApp();
    const res = await api
      .post("/api/orders")
      .send(orderBody({ quantity: 3 }))
      .expect(400);
    expect(res.body.error.fields.quantity).toBe("Il ne reste que 2 articles en taille M (Noir).");
  });

  it("gives unique order numbers to simultaneous orders", async () => {
    const { api } = testApp();
    const phones = ["0550000001", "0550000002", "0550000003", "0550000004", "0550000005"];
    const responses = await Promise.all(
      phones.map((phone) => api.post("/api/orders").send(orderBody({ phone }))),
    );
    expect(responses.map((res) => res.status)).toEqual(phones.map(() => 201));
    const numbers = (await OrderModel.find().lean()).map((order) => order.orderNumber).sort();
    expect(numbers).toEqual(["RSM-000001", "RSM-000002", "RSM-000003", "RSM-000004", "RSM-000005"]);
    expect((await CounterModel.findById("orderNumber").lean())?.seq).toBe(5);
  });
});

describe("POST /api/orders: fake orders", () => {
  it("honeypot filled: answers like a success but saves nothing and keeps the stock", async () => {
    const { api, metaEvents } = testApp();
    const before = await stockOf("prod_003", "Noir", "M");
    const res = await api
      .post("/api/orders")
      .send(orderBody({}, { website: "http://spam.example" }))
      .expect(201);
    expect(placedOrderSchema.safeParse(res.body).success).toBe(true);
    expect(await OrderModel.countDocuments()).toBe(0);
    expect(await stockOf("prod_003", "Noir", "M")).toBe(before);
    expect(metaEvents.sendPurchase).not.toHaveBeenCalled();
  });

  it("same phone + same product within 30 minutes: returns the first order, creates none", async () => {
    const { api } = testApp();
    const first = await api.post("/api/orders").send(orderBody()).expect(201);
    const before = await stockOf("prod_003", "Noir", "M");
    const second = await api
      .post("/api/orders")
      .send(orderBody({ quantity: 2 }))
      .expect(201);
    expect(second.body).toEqual(first.body);
    expect(await OrderModel.countDocuments()).toBe(1);
    expect(await stockOf("prod_003", "Noir", "M")).toBe(before);

    // Another product from the same phone is a new order.
    await api
      .post("/api/orders")
      .send(orderBody({ productId: "prod_001", color: "Noir", size: "L" }))
      .expect(201);
    expect(await OrderModel.countDocuments()).toBe(2);
  });

  it("flags (without blocking) many orders from the same phone in 24 h", async () => {
    const { api } = testApp();
    for (const productId of ["prod_001", "prod_003", "prod_006"]) {
      await api
        .post("/api/orders")
        .send(orderBody({ productId, color: "Noir", size: "L" }))
        .expect(201);
    }
    const orders = await OrderModel.find().sort({ createdAt: 1 }).lean();
    expect(orders.map((order) => order.suspicious)).toEqual([false, false, true]);
    expect(orders[2]?.suspiciousReason).toBe("3 commandes avec ce numéro de téléphone en 24 h");
  });

  it("flags many orders from the same IP in 24 h", async () => {
    const { api } = testApp();
    const phones = ["0551000001", "0551000002", "0551000003", "0551000004", "0551000005"];
    for (const phone of phones)
      await api.post("/api/orders").send(orderBody({ phone })).expect(201);
    const last = await OrderModel.findOne().sort({ createdAt: -1 }).lean();
    expect(last).toMatchObject({
      suspicious: true,
      suspiciousReason: "5 commandes depuis la même adresse IP en 24 h",
    });
  });

  it("saves the client IP and user agent", async () => {
    const { api } = testApp();
    await api
      .post("/api/orders")
      .set("User-Agent", "TestBrowser/1.0")
      .send(orderBody())
      .expect(201);
    const order = await OrderModel.findOne().lean();
    expect(order?.client.userAgent).toBe("TestBrowser/1.0");
    expect(order?.client.ip).toMatch(/127\.0\.0\.1|::1/);
  });
});

describe("POST /api/orders: Meta Conversions API", () => {
  it("hands the saved order to the Meta sender, with the fbp/fbc cookies", async () => {
    const { api, metaEvents } = testApp();
    const res = await api
      .post("/api/orders")
      .send(
        orderBody(
          {},
          {
            tracking: {
              fbp: "fb.1.1712345678901.123456789",
              fbc: "fb.1.1712345678901.IwAR0abc",
              eventSourceUrl: "http://localhost:3000/collection/fragment-sweatshirt",
            },
          },
        ),
      )
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(metaEvents.sendPurchase).toHaveBeenCalledTimes(1);
    const sent = metaEvents.sendPurchase.mock.calls[0]?.[0];
    expect(sent?._id.toString()).toBe(res.body.eventId);
    expect(sent?.tracking).toMatchObject({ fbp: "fb.1.1712345678901.123456789" });
  });

  it("a failing Meta sender never fails the order", async () => {
    const { api, metaEvents } = testApp();
    metaEvents.sendPurchase.mockRejectedValueOnce(new Error("Meta is down"));
    await api.post("/api/orders").send(orderBody()).expect(201);
    expect(await OrderModel.countDocuments()).toBe(1);
  });
});
