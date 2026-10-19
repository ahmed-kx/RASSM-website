import { mockProducts } from "@rassm/shared/mocks";
import { describe, expect, it } from "vitest";
import { ProductModel } from "../src/models/product";
import { seedDatabase } from "../src/seed";
import { testApp } from "./helpers";

describe("catalog", () => {
  it("lists the products on sale in catalog order, in the shared shape", async () => {
    const { api } = testApp();
    const res = await api.get("/api/products?sort=new").expect(200);
    expect(res.body.products).toHaveLength(mockProducts.length);
    const all = await api.get("/api/products").expect(200);
    expect(all.body.products).toEqual(
      [...mockProducts].sort((a, b) => Number(b.featured) - Number(a.featured)),
    );
  });

  it("applies the collection page filters", async () => {
    const { api } = testApp();
    const res = await api.get("/api/products?category=tshirt&color=creme&size=M").expect(200);
    // Classic Tee is sold out in Crème M: only the Crème t-shirts with M in stock remain.
    expect(res.body.products.map((p: { slug: string }) => p.slug)).toEqual([
      "unspoken-tee",
      "inner-voice-tee",
    ]);
  });

  it("hides inactive products", async () => {
    await ProductModel.updateOne({ _id: "prod_001" }, { $set: { isActive: false } });
    const { api } = testApp();
    const res = await api.get("/api/products").expect(200);
    expect(res.body.products.some((p: { id: string }) => p.id === "prod_001")).toBe(false);
    await api.get("/api/products/signature-hoodie").expect(404);
  });

  it("returns a product by slug, or a French 404", async () => {
    const { api } = testApp();
    const res = await api.get("/api/products/classic-tee").expect(200);
    expect(res.body.product.colors[1]).toMatchObject({ name: "Crème", stock: { M: 0, L: 3 } });
    const missing = await api.get("/api/products/nope").expect(404);
    expect(missing.body).toEqual({ error: { message: "Produit introuvable." } });
  });

  it("returns the 58 delivery fees", async () => {
    const { api } = testApp();
    const res = await api.get("/api/delivery-fees").expect(200);
    expect(res.body.deliveryFees).toHaveLength(58);
    expect(res.body.deliveryFees[15]).toEqual({
      wilayaCode: 16,
      homePrice: 400,
      stopDeskPrice: 250,
      estimatedDays: 1,
    });
    expect(res.body.deliveryFees[36].stopDeskPrice).toBeNull();
  });
});

describe("seed", () => {
  it("can run again without duplicates and keeps the real stock", async () => {
    await ProductModel.updateOne(
      { _id: "prod_003", "colors.name": "Noir" },
      { $set: { "colors.$.stock.M": 1 } },
    );
    const result = await seedDatabase();
    expect(result).toMatchObject({ productsCreated: 0, productsKept: mockProducts.length });
    expect(await ProductModel.countDocuments()).toBe(mockProducts.length);
    const product = await ProductModel.findById("prod_003").lean();
    expect(product?.colors[0]?.stock.M).toBe(1);

    await seedDatabase({ reset: true });
    expect((await ProductModel.findById("prod_003").lean())?.colors[0]?.stock.M).toBe(10);
  });
});
