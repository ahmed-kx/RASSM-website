import { describe, expect, it } from "vitest";
import { DeliveryFeeModel } from "../src/models/delivery-fee";
import { ProductModel, ensureProductSkus } from "../src/models/product";
import { FAKE_STORAGE_BASE, adminAgent, orderBody, testApp, ORIGIN } from "./helpers";

type Agent = Awaited<ReturnType<typeof adminAgent>>;

const photo = (name: string) => `${FAKE_STORAGE_BASE}${name}.webp`;
const stock = (S = 2, M = 3, L = 4, XL = 0, XXL = 0) => ({ S, M, L, XL, XXL });

/** A product as the dashboard form sends it. */
function productInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Hoodie Test",
    slug: "hoodie-test",
    description: "Un hoodie de test pour vérifier le tableau de bord.",
    category: "hoodie",
    price: 8500,
    colors: [
      { name: "Noir", hex: "#111111", images: [photo("noir-1"), photo("noir-2")], stock: stock() },
      { name: "Crème", hex: "#EDE8DF", images: [photo("creme-1")], stock: stock(1, 0, 0) },
    ],
    featured: false,
    isActive: true,
    deliveryDiscountTiers: [{ type: "amount", minQuantity: 2, amount: 200 }],
    drop: "Drop 002",
    ...overrides,
  };
}

const create = (agent: Agent, overrides: Record<string, unknown> = {}) =>
  agent.post("/api/admin/products").send({ product: productInput(overrides) });

describe("admin products: access", () => {
  it("protects every product, photo and delivery route (401)", async () => {
    const { api } = testApp();
    const calls: [string, () => PromiseLike<{ status: number }>][] = [
      ["GET products", () => api.get("/api/admin/products")],
      [
        "POST products",
        () =>
          api.post("/api/admin/products").set("Origin", ORIGIN).send({ product: productInput() }),
      ],
      ["GET product", () => api.get("/api/admin/products/prod_001")],
      [
        "PUT product",
        () =>
          api
            .put("/api/admin/products/prod_001")
            .set("Origin", ORIGIN)
            .send({ product: productInput() }),
      ],
      [
        "PATCH stock",
        () =>
          api
            .patch("/api/admin/products/prod_001/stock")
            .set("Origin", ORIGIN)
            .send({ colors: [] }),
      ],
      [
        "PATCH flags",
        () =>
          api
            .patch("/api/admin/products/prod_001/flags")
            .set("Origin", ORIGIN)
            .send({ isActive: false }),
      ],
      [
        "POST duplicate",
        () => api.post("/api/admin/products/prod_001/duplicate").set("Origin", ORIGIN),
      ],
      ["DELETE product", () => api.delete("/api/admin/products/prod_001").set("Origin", ORIGIN)],
      ["POST uploads", () => api.post("/api/admin/uploads").set("Origin", ORIGIN)],
      [
        "DELETE uploads",
        () =>
          api
            .delete("/api/admin/uploads")
            .set("Origin", ORIGIN)
            .send({ url: photo("x") }),
      ],
      ["GET delivery", () => api.get("/api/admin/delivery-fees")],
      ["PUT delivery", () => api.put("/api/admin/delivery-fees/16").set("Origin", ORIGIN).send({})],
      ["POST bulk", () => api.post("/api/admin/delivery-fees/bulk").set("Origin", ORIGIN).send({})],
      ["GET settings", () => api.get("/api/admin/settings")],
      [
        "PUT settings",
        () => api.put("/api/admin/settings").set("Origin", ORIGIN).send({ lowStockThreshold: 3 }),
      ],
    ];
    for (const [label, call] of calls) {
      expect((await call()).status, label).toBe(401);
    }
  });
});

describe("admin products", () => {
  it("creates a product with a readable SKU, a unique slug and refreshes the website", async () => {
    const { app, api, revalidator } = testApp();
    const agent = await adminAgent(app);
    const res = await create(agent).expect(201);
    expect(res.body.product).toMatchObject({
      id: "prod_010",
      sku: "RSM-H-005",
      name: "Hoodie Test",
      images: [photo("noir-1"), photo("noir-2")],
      isActive: true,
    });
    expect(revalidator.revalidate).toHaveBeenCalledWith(["products"]);
    await api.get("/api/products/hoodie-test").expect(200);

    const again = await create(agent, { name: "Autre" }).expect(409);
    expect(again.body.error.fields).toEqual({
      slug: "Ce slug est déjà utilisé par un autre produit.",
    });

    const tee = await create(agent, { slug: "tee-test", category: "tshirt" }).expect(201);
    expect(tee.body.product.sku).toBe("RSM-T-004");
  });

  it("refuses an invalid product with French errors under each field", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    const res = await create(agent, {
      price: 0,
      colors: [{ name: "Noir", hex: "#111111", images: [], stock: { S: -1, M: 1, L: 1, XL: 1 } }],
      deliveryDiscountTiers: [
        { type: "amount", minQuantity: 2, amount: 300 },
        { type: "amount", minQuantity: 3, amount: 200 },
      ],
    }).expect(400);
    const fields = res.body.error.fields as Record<string, string>;
    expect(fields.price).toBe("Le prix doit être supérieur à 0.");
    expect(fields["colors.0.images"]).toBe("Ajoutez au moins une photo pour cette couleur.");
    expect(fields["colors.0.stock.S"]).toBe("Le stock de la taille S ne peut pas être négatif.");
    expect(fields["colors.0.stock.XXL"]).toMatch(/^Stock manquant pour la taille XXL/);
    expect(Object.keys(fields).some((key) => key.startsWith("deliveryDiscountTiers"))).toBe(true);

    // A tier amount must stay below the highest home price of the fee table (1 800 DA).
    const tooBig = await create(agent, {
      deliveryDiscountTiers: [{ type: "amount", minQuantity: 2, amount: 1800 }],
    }).expect(400);
    expect(tooBig.body.error.fields["deliveryDiscountTiers.0.amount"]).toMatch(
      /inférieur au tarif de livraison à domicile le plus élevé/,
    );
  });

  it("edits a product, deletes the photos it no longer uses, and refuses a stale edit", async () => {
    const { app, imageStorage } = testApp();
    const agent = await adminAgent(app);
    const created = await create(agent).expect(201);
    const id = created.body.product.id as string;
    const { updatedAt } = created.body;

    const colors = productInput().colors.map((color, index) =>
      index === 0 ? { ...color, images: [photo("noir-2")], stock: stock(5, 5, 5, 5, 5) } : color,
    );
    const res = await agent
      .put(`/api/admin/products/${id}`)
      .send({ product: productInput({ price: 9000, colors }), updatedAt })
      .expect(200);
    expect(res.body.product).toMatchObject({ price: 9000, images: [photo("noir-2")] });
    expect(imageStorage.remove).toHaveBeenCalledWith(photo("noir-1"));
    expect(imageStorage.remove).toHaveBeenCalledTimes(1);

    // Saved with the old date: someone (or an order) changed it meanwhile.
    const stale = await agent
      .put(`/api/admin/products/${id}`)
      .send({ product: productInput(), updatedAt })
      .expect(409);
    expect(stale.body.error.message).toMatch(/a changé entre-temps/);
  });

  it("edits the stock grid quickly and refuses unknown colors or negative stock", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    const res = await agent
      .patch("/api/admin/products/prod_003/stock")
      .send({ colors: [{ name: "Noir", stock: stock(0, 1, 2, 3, 4) }] })
      .expect(200);
    expect(res.body.product.colors[0].stock).toEqual(stock(0, 1, 2, 3, 4));
    await agent
      .patch("/api/admin/products/prod_003/stock")
      .send({ colors: [{ name: "Violet", stock: stock() }] })
      .expect(400);
    const negative = await agent
      .patch("/api/admin/products/prod_003/stock")
      .send({ colors: [{ name: "Noir", stock: stock(-2) }] })
      .expect(400);
    expect(negative.body.error.fields["colors.0.stock.S"]).toBe(
      "Le stock de la taille S ne peut pas être négatif.",
    );
  });

  it("hides a product from the website (404 page) and shows it again", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    await agent.patch("/api/admin/products/prod_002/flags").send({ isActive: false }).expect(200);
    await api.get("/api/products/sketch-hoodie").expect(404);
    const list = await api.get("/api/products").expect(200);
    expect(list.body.products.map((p: { id: string }) => p.id)).not.toContain("prod_002");

    await agent.patch("/api/admin/products/prod_002/flags").send({ isActive: true }).expect(200);
    await api.get("/api/products/sketch-hoodie").expect(200);
  });

  it("duplicates as a hidden copy with a new slug and SKU and no stock", async () => {
    const { app, imageStorage } = testApp();
    const agent = await adminAgent(app);
    const created = await create(agent).expect(201);
    const id = created.body.product.id as string;

    const copy = await agent.post(`/api/admin/products/${id}/duplicate`).expect(201);
    expect(copy.body.product).toMatchObject({
      name: "Hoodie Test (copie)",
      slug: "hoodie-test-copie",
      sku: "RSM-H-006",
      isActive: false,
      featured: false,
      images: created.body.product.images,
    });
    for (const color of copy.body.product.colors) expect(color.stock).toEqual(stock(0, 0, 0, 0, 0));

    const second = await agent.post(`/api/admin/products/${id}/duplicate`).expect(201);
    expect(second.body.product.slug).toBe("hoodie-test-copie-2");

    // Deleting a copy keeps the photos the original still uses.
    await agent.delete(`/api/admin/products/${copy.body.product.id}`).expect(200);
    expect(imageStorage.remove).not.toHaveBeenCalled();
  });

  it("deletes a product without orders (and its photos), never one with orders", async () => {
    const { app, api, imageStorage } = testApp();
    const agent = await adminAgent(app);
    const created = await create(agent).expect(201);
    const id = created.body.product.id as string;
    await agent.delete(`/api/admin/products/${id}`).expect(200);
    expect(await ProductModel.exists({ _id: id })).toBeNull();
    expect(imageStorage.remove.mock.calls.map(([url]) => url).sort()).toEqual(
      [photo("creme-1"), photo("noir-1"), photo("noir-2")].sort(),
    );

    await api.post("/api/orders").send(orderBody()).expect(201);
    const refused = await agent.delete("/api/admin/products/prod_003").expect(409);
    expect(refused.body.error.message).toMatch(/ne peut pas être supprimé, seulement masqué/);
    expect(await ProductModel.exists({ _id: "prod_003" })).not.toBeNull();
  });

  it("flags Stock faible from the total stock and the threshold saved in the settings", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    expect((await agent.get("/api/admin/settings").expect(200)).body).toEqual({
      lowStockThreshold: 10,
      packagingCost: 0,
      returnCost: 0,
    });
    // 9 units in total (one size with a single unit): low at the default threshold of 10.
    const created = await create(agent, {
      colors: [{ name: "Noir", hex: "#111111", images: [photo("noir-1")], stock: stock(1, 4, 4) }],
    }).expect(201);
    const id = created.body.product.id;
    const statusOf = async () =>
      (await agent.get("/api/admin/products?limit=50").expect(200)).body.products.find(
        (p: { id: string }) => p.id === id,
      ).status;
    expect(await statusOf()).toBe("low");

    const saved = await agent.put("/api/admin/settings").send({ lowStockThreshold: 5 }).expect(200);
    expect(saved.body).toEqual({ lowStockThreshold: 5, packagingCost: 0, returnCost: 0 });
    const list = await agent.get("/api/admin/products?limit=50").expect(200);
    expect(list.body.lowStockThreshold).toBe(5);
    expect(await statusOf()).toBe("active");

    await agent
      .patch(`/api/admin/products/${id}/stock`)
      .send({ colors: [{ name: "Noir", stock: stock(0, 0, 0) }] })
      .expect(200);
    expect(await statusOf()).toBe("out");

    const bad = await agent.put("/api/admin/settings").send({ lowStockThreshold: -2 }).expect(400);
    expect(bad.body.error.fields.lowStockThreshold).toBe("Le seuil ne peut pas être négatif.");
  });

  it("lists products by category with counts, filters, sort and KPIs", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    const all = await agent.get("/api/admin/products?limit=50").expect(200);
    expect(all.body.counts).toMatchObject({ all: 9, hoodie: 4, sweatshirt: 2, tshirt: 3 });
    expect(all.body.total).toBe(9);
    expect(all.body.drops).toContain("Drop 001");
    expect(all.body.kpis.products.value).toBe(9);
    // Stock value = units × price, from the same data.
    const value = all.body.products.reduce(
      (sum: number, p: { stockTotal: number; price: number }) => sum + p.stockTotal * p.price,
      0,
    );
    expect(all.body.kpis.stockValue).toEqual({ value, trend: null });

    const hoodies = await agent
      .get("/api/admin/products?category=hoodie&sort=price-asc")
      .expect(200);
    expect(hoodies.body.products).toHaveLength(4);
    const prices = hoodies.body.products.map((p: { price: number }) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    const search = await agent.get("/api/admin/products?q=RSM-S-001").expect(200);
    expect(search.body.products.map((p: { name: string }) => p.name)).toEqual([
      "Fragment Sweatshirt",
    ]);
  });

  it("gives a SKU to products created before SKUs existed", async () => {
    await ProductModel.updateOne({ _id: "prod_009" }, { $unset: { sku: "" } });
    expect(await ensureProductSkus()).toBe(1);
    const doc = await ProductModel.findById("prod_009").lean();
    expect(doc?.sku).toBe("RSM-H-004");
    expect(await ensureProductSkus()).toBe(0);
  });
});

describe("admin photos", () => {
  // A real 1 × 1 PNG.
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );

  it("uploads a JPG, PNG or WebP photo, refuses other files and big ones", async () => {
    const { app, imageStorage } = testApp();
    const agent = await adminAgent(app);
    const res = await agent
      .post("/api/admin/uploads")
      .attach("image", PNG, "photo.png")
      .expect(201);
    expect(res.body.image.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);

    const text = await agent
      .post("/api/admin/uploads")
      .attach("image", Buffer.from("not an image at all"), {
        filename: "x.png",
        contentType: "image/png",
      })
      .expect(415);
    expect(text.body.error.message).toBe("Format non accepté : photo JPG, PNG ou WebP uniquement.");

    const big = Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024)]);
    const tooBig = await agent
      .post("/api/admin/uploads")
      .attach("image", big, "big.png")
      .expect(413);
    expect(tooBig.body.error.message).toMatch(/dépasse 8 Mo/);
    expect(imageStorage.upload).toHaveBeenCalledTimes(1);

    // A photo removed from the form before saving is deleted (nothing uses it).
    await agent.delete("/api/admin/uploads").send({ url: res.body.image.url }).expect(200);
    expect(imageStorage.remove).toHaveBeenCalledWith(res.body.image.url);
  });

  it("answers 503 in French when Cloudinary is not configured", async () => {
    const { app } = testApp({ imageStorage: null });
    const agent = await adminAgent(app);
    const res = await agent
      .post("/api/admin/uploads")
      .attach("image", PNG, "photo.png")
      .expect(503);
    expect(res.body.error.message).toMatch(/clés Cloudinary manquantes/);
  });
});

describe("admin delivery prices", () => {
  const alger = { homePrice: 450, stopDeskPrice: 300, estimatedDays: 1, suspended: false };

  it("updates a wilaya and refreshes the website", async () => {
    const { app, revalidator } = testApp();
    const agent = await adminAgent(app);
    const res = await agent.put("/api/admin/delivery-fees/16").send(alger).expect(200);
    expect(res.body.deliveryFees[15]).toEqual({ wilayaCode: 16, ...alger });
    expect(revalidator.revalidate).toHaveBeenCalledWith(["delivery-fees"]);
    expect((await DeliveryFeeModel.findOne({ wilayaCode: 16 }).lean())?.homePrice).toBe(450);

    const invalid = await agent
      .put("/api/admin/delivery-fees/16")
      .send({ ...alger, homePrice: -5, estimatedDays: 1.5 })
      .expect(400);
    expect(invalid.body.error.fields).toMatchObject({
      homePrice: "Le prix à domicile doit être supérieur à 0 DA.",
      estimatedDays: "Le délai doit être un nombre entier de jours.",
    });
  });

  it("switches the stop desk off: stop desk orders are refused there", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    await agent
      .put("/api/admin/delivery-fees/16")
      .send({ ...alger, stopDeskPrice: null })
      .expect(200);
    const res = await api
      .post("/api/orders")
      .send(orderBody({ deliveryType: "stopdesk", address: "" }))
      .expect(400);
    expect(res.body.error.fields.deliveryType).toMatch(/n'est pas disponible/);
  });

  it("refuses orders in a suspended wilaya, then accepts them again", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    await agent
      .put("/api/admin/delivery-fees/16")
      .send({ ...alger, suspended: true })
      .expect(200);
    const res = await api.post("/api/orders").send(orderBody()).expect(400);
    expect(res.body.error.fields).toEqual({
      wilayaCode: "Livraison temporairement indisponible dans cette wilaya.",
    });
    const fees = await api.get("/api/delivery-fees").expect(200);
    expect(fees.body.deliveryFees[15].suspended).toBe(true);

    await agent
      .post("/api/admin/delivery-fees/bulk")
      .send({ action: "reactivate", codes: [16] })
      .expect(200);
    await api.post("/api/orders").send(orderBody()).expect(201);
  });

  it("changes the prices of selected wilayas by ± X DA, with a preview and limits", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    const preview = await agent
      .post("/api/admin/delivery-fees/bulk?apercu=1")
      .send({ action: "adjust", codes: [16, 37], amount: 50 })
      .expect(200);
    expect(preview.body.deliveryFees[15]).toMatchObject({ homePrice: 450, stopDeskPrice: 300 });
    // Tindouf has no stop desk: it stays without one.
    expect(preview.body.deliveryFees[36].stopDeskPrice).toBeNull();
    expect((await DeliveryFeeModel.findOne({ wilayaCode: 16 }).lean())?.homePrice).toBe(400);

    await agent
      .post("/api/admin/delivery-fees/bulk")
      .send({ action: "adjust", codes: [16, 37], amount: 50 })
      .expect(200);
    expect((await DeliveryFeeModel.findOne({ wilayaCode: 16 }).lean())?.homePrice).toBe(450);

    const negative = await agent
      .post("/api/admin/delivery-fees/bulk")
      .send({ action: "adjust", codes: [16], amount: -500 })
      .expect(400);
    expect(negative.body.error.message).toMatch(/passerait à .*choisissez un montant plus petit/);
  });

  it("warns when a price change makes a product discount tier invalid", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    // Valid today: 1 700 DA < 1 800 DA (Djanet, the highest home price).
    await create(agent, {
      deliveryDiscountTiers: [{ type: "amount", minQuantity: 2, amount: 1700 }],
    }).expect(201);
    // Djanet down to 1 400 DA: the highest becomes Tamanrasset (1 650 DA), below the tier.
    const djanet = await agent
      .put("/api/admin/delivery-fees/56?apercu=1")
      .send({ homePrice: 1400, stopDeskPrice: 900, estimatedDays: 9, suspended: false })
      .expect(200);
    expect(djanet.body.warnings).toEqual([
      { productId: "prod_010", productName: "Hoodie Test", amount: 1700, maxHomePrice: 1650 },
    ]);
    // Only a preview: nothing saved.
    expect((await DeliveryFeeModel.findOne({ wilayaCode: 56 }).lean())?.homePrice).toBe(1800);
  });

  it("refuses an admin edit that moves an order to a suspended wilaya", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    const placed = await api.post("/api/orders").send(orderBody()).expect(201);
    await agent
      .put("/api/admin/delivery-fees/31")
      .send({ ...alger, suspended: true })
      .expect(200);
    const edit = {
      color: "Noir",
      size: "M",
      quantity: 1,
      fullName: "Yacine Benali",
      phone: "0555123456",
      wilayaCode: 31,
      commune: "Oran",
      deliveryType: "home",
      address: "Rue 1",
    };
    const res = await agent
      .patch(`/api/admin/orders/${placed.body.eventId}`)
      .send(edit)
      .expect(400);
    expect(res.body.error.fields.wilayaCode).toBe(
      "Livraison temporairement indisponible dans cette wilaya.",
    );
  });
});
