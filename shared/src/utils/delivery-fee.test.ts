import { describe, expect, it } from "vitest";
import { getMockProductBySlug, mockDeliveryFees, mockProducts } from "../mocks";
import { WILAYAS } from "../constants/wilayas";
import { DeliveryTypeUnavailableError, getAvailableDeliveryTypes } from "../schemas/delivery";
import { orderSchema } from "../schemas/order";
import { createProductSchema, productSchema } from "../schemas/product";
import {
  getDeliveryFeeWithDiscount,
  getMaxHomeDeliveryPrice,
  type DeliveryDiscountProduct,
  type DeliveryFeeInput,
} from "./delivery-fee";

// Real mock fee table (Anderson): Alger 400 home / 250 stop desk, Tindouf 1,500 home / no stop desk.
const ALGER = 16;
const TINDOUF = 37;
const NO_STOP_DESK = [37, 50, 52, 54]; // Tindouf, Bordj Badji Mokhtar, Béni Abbès, In Guezzam

function product(slug: string): DeliveryDiscountProduct {
  const found = getMockProductBySlug(slug);
  if (!found) throw new Error(`Missing mock product ${slug}.`);
  return found;
}

const fragment = product("fragment-sweatshirt"); // 1 → 100, 2 → 200, 3 → free
const signature = product("signature-hoodie"); // 2 → free
const unspoken = product("unspoken-tee"); // 1 → 50
const classic = product("classic-tee"); // no tiers

function calc(
  items: DeliveryFeeInput["items"],
  options: Partial<Pick<DeliveryFeeInput, "wilayaCode" | "deliveryType" | "products">> = {},
) {
  return getDeliveryFeeWithDiscount({
    wilayaCode: ALGER,
    deliveryType: "home",
    products: mockProducts,
    deliveryFees: mockDeliveryFees,
    items,
    ...options,
  });
}

describe("getDeliveryFeeWithDiscount", () => {
  it("charges the full fee when no product has tiers", () => {
    const result = calc([{ productId: classic.id, quantity: 2 }]);
    expect(result).toEqual({
      deliveryFeeBase: 400,
      deliveryDiscount: 0,
      deliveryFee: 400,
      freeDelivery: false,
      deliveryDiscountLines: [],
      nextDeliveryDiscountTiers: [],
    });
  });

  it("1 Fragment Sweatshirt: 100 DA off", () => {
    const result = calc([{ productId: fragment.id, quantity: 1 }]);
    expect(result.deliveryFee).toBe(300);
    expect(result.deliveryDiscountLines).toEqual([
      {
        productId: fragment.id,
        productName: "Fragment Sweatshirt",
        quantity: 1,
        tier: { type: "amount", minQuantity: 1, amount: 100 },
        amount: 100,
      },
    ]);
  });

  it("2 Fragment Sweatshirts in different sizes: quantities add up across sizes", () => {
    const result = calc([
      { productId: fragment.id, quantity: 1 },
      { productId: fragment.id, quantity: 1 },
    ]);
    expect(result.deliveryFee).toBe(200);
    expect(result.deliveryDiscountLines[0]?.quantity).toBe(2);
  });

  it("3 Fragment Sweatshirts: free delivery", () => {
    const result = calc([{ productId: fragment.id, quantity: 3 }]);
    expect(result).toMatchObject({
      deliveryFeeBase: 400,
      deliveryDiscount: 400,
      deliveryFee: 0,
      freeDelivery: true,
      nextDeliveryDiscountTiers: [],
    });
  });

  it("1 Fragment Sweatshirt + 1 Unspoken Tee: amounts add up", () => {
    const result = calc([
      { productId: fragment.id, quantity: 1 },
      { productId: unspoken.id, quantity: 1 },
    ]);
    expect(result.deliveryDiscount).toBe(150);
    expect(result.deliveryFee).toBe(250);
    expect(result.deliveryDiscountLines.map((line) => line.amount)).toEqual([100, 50]);
  });

  it("1 Signature Hoodie: tier not reached, next tier says 1 more unit gives free delivery", () => {
    const result = calc([{ productId: signature.id, quantity: 1 }]);
    expect(result.deliveryFee).toBe(400);
    expect(result.deliveryDiscountLines).toEqual([]);
    expect(result.nextDeliveryDiscountTiers).toEqual([
      {
        productId: signature.id,
        productName: "Signature Hoodie",
        category: "hoodie",
        quantity: 1,
        missingQuantity: 1,
        tier: { type: "free", minQuantity: 2 },
      },
    ]);
  });

  it("reports the next better tier for a product that already has a discount", () => {
    const result = calc([{ productId: fragment.id, quantity: 1 }]);
    expect(result.nextDeliveryDiscountTiers).toMatchObject([
      { productId: fragment.id, missingQuantity: 1, tier: { minQuantity: 2, amount: 200 } },
    ]);
  });

  it("discounts adding up to more than the stop-desk fee: 0, never negative", () => {
    const extra: DeliveryDiscountProduct = {
      id: "test_extra",
      name: "Test Tee",
      category: "tshirt",
      deliveryDiscountTiers: [{ type: "amount", minQuantity: 1, amount: 150 }],
    };
    const result = calc(
      [
        { productId: fragment.id, quantity: 2 },
        { productId: extra.id, quantity: 1 },
      ],
      { deliveryType: "stopdesk", products: [...mockProducts, extra] },
    );
    expect(result).toMatchObject({
      deliveryFeeBase: 250,
      deliveryDiscount: 250,
      deliveryFee: 0,
      freeDelivery: false,
      nextDeliveryDiscountTiers: [],
    });
  });

  it("applies the discount on a high fee: Tindouf home delivery", () => {
    const result = calc([{ productId: fragment.id, quantity: 1 }], { wilayaCode: TINDOUF });
    expect(result).toMatchObject({
      deliveryFeeBase: 1500,
      deliveryDiscount: 100,
      deliveryFee: 1400,
    });
    const free = calc([{ productId: fragment.id, quantity: 3 }], { wilayaCode: TINDOUF });
    expect(free).toMatchObject({ deliveryDiscount: 1500, deliveryFee: 0, freeDelivery: true });
  });

  it("rejects stop desk in the 4 wilayas without one, with a French error", () => {
    for (const wilayaCode of NO_STOP_DESK) {
      expect(() =>
        calc([{ productId: fragment.id, quantity: 1 }], {
          wilayaCode,
          deliveryType: "stopdesk",
        }),
      ).toThrow(DeliveryTypeUnavailableError);
    }
    expect(() => calc([], { wilayaCode: TINDOUF, deliveryType: "stopdesk" })).toThrow(
      "La livraison au bureau (stop desk) n'est pas disponible dans la wilaya de Tindouf. Choisissez la livraison à domicile.",
    );
  });

  it("applies tiers with home delivery in the 4 wilayas without stop desk", () => {
    for (const wilayaCode of NO_STOP_DESK) {
      const result = calc([{ productId: fragment.id, quantity: 2 }], { wilayaCode });
      expect(result.deliveryDiscount).toBe(200);
      expect(result.deliveryFee).toBe(result.deliveryFeeBase - 200);
    }
  });

  it("mock fees: only those 4 wilayas have no stop desk", () => {
    const withoutStopDesk = mockDeliveryFees
      .filter((fee) => fee.stopDeskPrice === null)
      .map((fee) => fee.wilayaCode);
    expect(withoutStopDesk).toEqual(NO_STOP_DESK);
    const alger = mockDeliveryFees.find((fee) => fee.wilayaCode === ALGER);
    expect(alger && getAvailableDeliveryTypes(alger)).toEqual(["home", "stopdesk"]);
    const tindouf = mockDeliveryFees.find((fee) => fee.wilayaCode === TINDOUF);
    expect(tindouf && getAvailableDeliveryTypes(tindouf)).toEqual(["home"]);
  });

  it("throws for an unknown product or a wilaya with no fee", () => {
    expect(() => calc([{ productId: "nope", quantity: 1 }])).toThrow("Produit inconnu : nope.");
    expect(() => calc([], { wilayaCode: 99 })).toThrow(
      "Aucun tarif de livraison pour la wilaya 99.",
    );
  });
});

describe("product deliveryDiscountTiers validation", () => {
  const base = mockProducts[0];
  if (!base) throw new Error("Mock products are empty.");
  const strict = createProductSchema(getMaxHomeDeliveryPrice(mockDeliveryFees));
  const messages = (tiers: unknown) => {
    const result = strict.safeParse({ ...base, deliveryDiscountTiers: tiers });
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it("defaults to no tiers", () => {
    const { deliveryDiscountTiers: _omit, ...withoutTiers } = base;
    expect(productSchema.parse(withoutTiers).deliveryDiscountTiers).toEqual([]);
  });

  it("rejects two tiers with the same minQuantity", () => {
    expect(
      messages([
        { type: "amount", minQuantity: 2, amount: 100 },
        { type: "free", minQuantity: 2 },
      ]),
    ).toEqual(["Deux paliers ne peuvent pas avoir la même quantité minimum (2)."]);
  });

  it("rejects more than 5 tiers", () => {
    const sixTiers = [1, 2, 3, 4, 5, 6].map((minQuantity) => ({
      type: "amount",
      minQuantity,
      amount: minQuantity * 50,
    }));
    expect(messages(sixTiers)).toEqual([
      "Un produit peut avoir au maximum 5 paliers de réduction.",
    ]);
  });

  it("computes the maximum from the fee data: 1,800 DA (Djanet)", () => {
    expect(getMaxHomeDeliveryPrice(mockDeliveryFees)).toBe(1800);
    expect(mockDeliveryFees.find((fee) => fee.homePrice === 1800)?.wilayaCode).toBe(56);
  });

  it("rejects an amount not lower than the highest home delivery price", () => {
    expect(messages([{ type: "amount", minQuantity: 1, amount: 1800 }])).toEqual([
      "Le montant de la réduction doit être inférieur au tarif de livraison à domicile le plus élevé (1 800 DA).",
    ]);
    expect(messages([{ type: "amount", minQuantity: 1, amount: 1799 }])).toEqual([]);
  });

  it("accepts strictly increasing tiers ending with free, in any input order", () => {
    expect(
      messages([
        { type: "free", minQuantity: 3 },
        { type: "amount", minQuantity: 1, amount: 100 },
        { type: "amount", minQuantity: 2, amount: 200 },
      ]),
    ).toEqual([]);
  });

  it("rejects a tier that does not give more than the previous one", () => {
    expect(
      messages([
        { type: "amount", minQuantity: 1, amount: 200 },
        { type: "amount", minQuantity: 2, amount: 200 },
      ]),
    ).toEqual([
      "Le palier de 2 articles doit donner une réduction plus grande que celui de 1 article (200 DA).",
    ]);
    expect(
      messages([
        { type: "amount", minQuantity: 3, amount: 100 },
        { type: "amount", minQuantity: 1, amount: 300 },
      ]),
    ).toEqual([
      "Le palier de 3 articles doit donner une réduction plus grande que celui de 1 article (300 DA).",
    ]);
  });

  it("rejects a free tier that is not the last one", () => {
    expect(
      messages([
        { type: "free", minQuantity: 2 },
        { type: "amount", minQuantity: 3, amount: 300 },
      ]),
    ).toEqual([
      "La livraison gratuite doit être le dernier palier : le palier de 3 articles ne peut pas venir après celui de 2 articles.",
    ]);
  });

  it("all mock products pass the strict schema", () => {
    for (const mock of mockProducts) {
      expect(strict.safeParse(mock).success).toBe(true);
    }
  });

  it("rejects amount 0, minQuantity 0 and an unknown type", () => {
    expect(messages([{ type: "amount", minQuantity: 1, amount: 0 }])).toEqual([
      "Le montant de la réduction doit être supérieur à 0 DA.",
    ]);
    expect(messages([{ type: "free", minQuantity: 0 }])).toEqual([
      "La quantité minimum doit être d'au moins 1 article.",
    ]);
    expect(messages([{ type: "half", minQuantity: 1 }])).toEqual([
      "Choisissez le type de réduction : montant ou livraison gratuite.",
    ]);
  });
});

describe("order delivery checks", () => {
  // 2 Fragment Sweatshirts (tier: −200 DA) delivered at home in Alger (400 DA).
  const item = {
    productId: fragment.id,
    name: "Fragment Sweatshirt",
    slug: "fragment-sweatshirt",
    image: "/images/products/fragment-sweatshirt-front.jpg",
    color: "Noir",
    size: "M",
    quantity: 2,
    unitPrice: 6900,
  } as const;
  const { nextDeliveryDiscountTiers: _next, ...delivery } = calc([item]);

  const order = {
    id: "order_1",
    orderNumber: "RSM-000001",
    fullName: "Yacine Benali",
    phone: "0555123456",
    wilayaCode: ALGER,
    commune: "Bab Ezzouar",
    address: "Cité 1200 logements, bâtiment 5",
    deliveryType: "home",
    item,
    subtotal: 13800,
    ...delivery,
    total: 13800 + delivery.deliveryFee,
    status: "pending",
    paymentMethod: "cash_on_delivery",
    createdAt: "2026-10-17T10:00:00.000Z",
  } as const;

  const issuePaths = (data: object) => {
    const result = orderSchema.safeParse(data);
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
  };

  it("accepts an order built from the helper", () => {
    expect(order.deliveryFee).toBe(200);
    expect(issuePaths(order)).toEqual([]);
  });

  it("rejects a total that ignores the discount", () => {
    expect(issuePaths({ ...order, total: 14200 })).toEqual(["total"]);
  });

  it("rejects a subtotal that is not unit price × quantity", () => {
    expect(issuePaths({ ...order, subtotal: 6900, total: 6900 + order.deliveryFee })).toEqual([
      "subtotal",
    ]);
  });

  it("rejects a negative delivery fee", () => {
    expect(issuePaths({ ...order, deliveryDiscount: 500, deliveryFee: -100 })).toContain(
      "deliveryFee",
    );
  });

  it("rejects freeDelivery without a free tier, and a discount not matching the lines", () => {
    expect(
      issuePaths({
        ...order,
        freeDelivery: true,
        deliveryDiscount: 400,
        deliveryFee: 0,
        total: 13800,
      }),
    ).toEqual(["freeDelivery", "deliveryDiscount"]);
  });
});

describe("wilayas and Anderson fees", () => {
  it("has exactly the 58 official wilayas, codes 1 to 58, no duplicates", () => {
    expect(WILAYAS).toHaveLength(58);
    expect(WILAYAS.map((wilaya) => wilaya.code)).toEqual(
      Array.from({ length: 58 }, (_, index) => index + 1),
    );
    expect(new Set(WILAYAS.map((wilaya) => wilaya.name)).size).toBe(58);
  });

  it("has exactly one fee per wilaya", () => {
    expect(mockDeliveryFees).toHaveLength(58);
    expect(mockDeliveryFees.map((fee) => fee.wilayaCode)).toEqual(
      WILAYAS.map((wilaya) => wilaya.code),
    );
  });

  it("has exactly 4 wilayas without stop desk", () => {
    expect(mockDeliveryFees.filter((fee) => fee.stopDeskPrice === null)).toHaveLength(4);
  });

  it("matches the Anderson table for a few wilayas", () => {
    const fee = (code: number) => mockDeliveryFees.find((entry) => entry.wilayaCode === code);
    expect(fee(16)).toEqual({
      wilayaCode: 16,
      homePrice: 400,
      stopDeskPrice: 250,
      estimatedDays: 1,
    });
    expect(fee(50)).toEqual({
      wilayaCode: 50,
      homePrice: 1450,
      stopDeskPrice: null,
      estimatedDays: 10,
    });
    expect(fee(56)).toEqual({
      wilayaCode: 56,
      homePrice: 1800,
      stopDeskPrice: 900,
      estimatedDays: 9,
    });
  });
});
