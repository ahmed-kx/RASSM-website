import { describe, expect, it } from "vitest";
import { getMockProductBySlug, mockProducts } from "../mocks";
import {
  formatDeliveryDiscountTiers,
  formatDiscount,
  formatTierBenefit,
} from "./delivery-discount-format";
import { getDeliveryDiscountProgress } from "./delivery-fee";

function id(slug: string): string {
  const product = getMockProductBySlug(slug);
  if (!product) throw new Error(`Missing mock product ${slug}.`);
  return product.id;
}

const fragment = id("fragment-sweatshirt"); // 1 → 100, 2 → 200, 3 → free
const signature = id("signature-hoodie"); // 2 → free
const unspoken = id("unspoken-tee"); // 1 → 50
const classic = id("classic-tee"); // no tiers

const progress = (items: { productId: string; quantity: number }[]) =>
  getDeliveryDiscountProgress({ items, products: mockProducts });

describe("getDeliveryDiscountProgress (cart drawer, no wilaya yet)", () => {
  it("empty cart: nothing unlocked, nothing to suggest", () => {
    expect(progress([])).toEqual({
      freeDelivery: false,
      amountDiscount: 0,
      appliedTiers: [],
      nextDeliveryDiscountTiers: [],
    });
  });

  it("product without tiers: nothing to suggest", () => {
    expect(progress([{ productId: classic, quantity: 3 }]).nextDeliveryDiscountTiers).toEqual([]);
  });

  it("1 Fragment Sweatshirt: −100 DA, 1 more for −200 DA", () => {
    const result = progress([{ productId: fragment, quantity: 1 }]);
    expect(result.amountDiscount).toBe(100);
    expect(result.nextDeliveryDiscountTiers).toMatchObject([
      { productName: "Fragment Sweatshirt", missingQuantity: 1, tier: { amount: 200 } },
    ]);
  });

  it("2 Fragment Sweatshirts in two sizes: −200 DA, 1 more for free delivery", () => {
    const result = progress([
      { productId: fragment, quantity: 1 },
      { productId: fragment, quantity: 1 },
    ]);
    expect(result.amountDiscount).toBe(200);
    expect(result.nextDeliveryDiscountTiers).toMatchObject([
      { missingQuantity: 1, tier: { type: "free", minQuantity: 3 } },
    ]);
  });

  it("3 Fragment Sweatshirts: free delivery, no more suggestions", () => {
    const result = progress([{ productId: fragment, quantity: 3 }]);
    expect(result.freeDelivery).toBe(true);
    expect(result.nextDeliveryDiscountTiers).toEqual([]);
  });

  it("1 Signature Hoodie: nothing yet, 1 more for free delivery", () => {
    const result = progress([{ productId: signature, quantity: 1 }]);
    expect(result).toMatchObject({ freeDelivery: false, amountDiscount: 0, appliedTiers: [] });
    expect(result.nextDeliveryDiscountTiers).toMatchObject([
      { productName: "Signature Hoodie", missingQuantity: 1, tier: { type: "free" } },
    ]);
  });

  it("2 Signature Hoodies: free delivery unlocked", () => {
    expect(progress([{ productId: signature, quantity: 2 }]).freeDelivery).toBe(true);
  });

  it("amounts add up across products", () => {
    const result = progress([
      { productId: fragment, quantity: 1 },
      { productId: unspoken, quantity: 1 },
    ]);
    expect(result.amountDiscount).toBe(150);
    expect(result.appliedTiers.map((applied) => applied.productName)).toEqual([
      "Fragment Sweatshirt",
      "Unspoken Tee",
    ]);
  });
});

describe("French tier formatting", () => {
  it("formats one tier and a discount", () => {
    expect(formatTierBenefit({ type: "amount", minQuantity: 1, amount: 100 })).toBe("−100 DA");
    expect(formatTierBenefit({ type: "free", minQuantity: 3 })).toBe("livraison gratuite");
    expect(formatDiscount(1500)).toBe("−1 500 DA");
  });

  it("formats all tiers sorted by quantity", () => {
    expect(
      formatDeliveryDiscountTiers([
        { type: "free", minQuantity: 3 },
        { type: "amount", minQuantity: 1, amount: 100 },
        { type: "amount", minQuantity: 2, amount: 200 },
      ]),
    ).toBe("1 article : −100 DA · 2 articles : −200 DA · 3 articles : livraison gratuite");
    expect(formatDeliveryDiscountTiers([])).toBe("");
  });
});
