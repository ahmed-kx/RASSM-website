import { describe, expect, it } from "vitest";
import { getMockProductBySlug } from "../mocks";
import {
  fromPublicProduct,
  getSizeStock,
  getVariantStock,
  isProductInStock,
  publicProductSchema,
  toPublicProduct,
  toVariantAvailability,
} from "./product";
import { MAX_QUANTITY_PER_ORDER, createProductOrderSchema } from "./product-order";

const found = getMockProductBySlug("classic-tee");
if (!found) throw new Error("Missing mock product classic-tee.");
const classicTee = found;
// Classic Tee: Noir { S 10, M 20, L 20, XL 12, XXL 6 }, Crème { S 4, M 0, L 3, XL 2, XXL 0 }.

describe("public products (no exact stock, no SKU)", () => {
  it("gives each size as available, low with its number (3 or less) or sold out", () => {
    expect([0, 1, 3, 4, 50].map(toVariantAvailability)).toEqual([
      { status: "sold_out" },
      { status: "low", remaining: 1 },
      { status: "low", remaining: 3 },
      { status: "available" },
      { status: "available" },
    ]);
    const published = publicProductSchema.parse(toPublicProduct(classicTee));
    expect(published).not.toHaveProperty("sku");
    expect(JSON.stringify(published)).not.toMatch(/"stock"/);
    expect(published.colors[1]?.availability).toEqual({
      S: { status: "available" },
      M: { status: "sold_out" },
      L: { status: "low", remaining: 3 },
      XL: { status: "low", remaining: 2 },
      XXL: { status: "sold_out" },
    });
  });

  it("works on the shop pages as before: sold-out sizes, 'Plus que N', at most 5 per order", () => {
    const shop = fromPublicProduct(toPublicProduct(classicTee), MAX_QUANTITY_PER_ORDER);
    expect(getVariantStock(shop, "Crème", "M")).toBe(0);
    expect(getVariantStock(shop, "Crème", "L")).toBe(3);
    expect(getVariantStock(shop, "Noir", "M")).toBe(MAX_QUANTITY_PER_ORDER);
    expect(getSizeStock(shop, "XXL")).toBe(MAX_QUANTITY_PER_ORDER);
    expect(isProductInStock(shop)).toBe(true);
    // The order form refuses the same things as with the real stock.
    const order = {
      productId: shop.id,
      color: "Crème",
      size: "L" as const,
      quantity: 4,
      fullName: "Yacine Benali",
      phone: "0555123456",
      wilayaCode: 16,
      commune: "Bab Ezzouar",
      deliveryType: "home" as const,
      address: "Cité 1200 logements, bâtiment 5",
    };
    expect(createProductOrderSchema(shop).safeParse(order).success).toBe(false);
    expect(createProductOrderSchema(shop).safeParse({ ...order, quantity: 3 }).success).toBe(true);
    expect(
      createProductOrderSchema(shop).safeParse({ ...order, color: "Noir", quantity: 5 }).success,
    ).toBe(true);
  });
});
