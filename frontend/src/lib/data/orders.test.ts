import type { ProductOrder } from "@rassm/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeProductOrder } from "./orders";

// Fragment Sweatshirt: 6 900 DA, tiers 1 → −100 DA, 2 → −200 DA, 3 → free delivery.
// Alger: 400 DA home, 250 DA stop desk. Tindouf (37): no stop desk.
const base: ProductOrder = {
  productId: "prod_003",
  color: "Noir",
  size: "M",
  quantity: 1,
  fullName: "Yacine Benali",
  phone: "0555123456",
  wilayaCode: 16,
  commune: "Bab Ezzouar",
  deliveryType: "home",
  address: "Cité 1200 logements, bâtiment 5",
};

async function place(overrides: Partial<ProductOrder>) {
  const pending = placeProductOrder({ ...base, ...overrides });
  // Keep a handled reference so a rejection is not reported before the test awaits it.
  pending.catch(() => undefined);
  await vi.advanceTimersByTimeAsync(1000);
  return pending;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("placeProductOrder", () => {
  it.each([
    { quantity: 1, subtotal: 6900, discount: 100, fee: 300, free: false, total: 7200 },
    { quantity: 2, subtotal: 13800, discount: 200, fee: 200, free: false, total: 14000 },
    { quantity: 3, subtotal: 20700, discount: 400, fee: 0, free: true, total: 20700 },
  ])(
    "prices $quantity Fragment Sweatshirt(s) delivered at home in Alger",
    async ({ quantity, subtotal, discount, fee, free, total }) => {
      const order = await place({ quantity });
      expect(order).toMatchObject({
        orderNumber: expect.stringMatching(/^RSM-\d{6}$/),
        item: { productId: "prod_003", color: "Noir", size: "M", quantity, unitPrice: 6900 },
        subtotal,
        deliveryFeeBase: 400,
        deliveryDiscount: discount,
        deliveryFee: fee,
        freeDelivery: free,
        total,
        status: "pending",
        paymentMethod: "cash_on_delivery",
      });
    },
  );

  it("uses the stop desk price", async () => {
    const order = await place({ deliveryType: "stopdesk", address: "" });
    expect(order).toMatchObject({ deliveryFeeBase: 250, deliveryFee: 150, total: 7050 });
  });

  it("refuses stop desk in Tindouf, in French", async () => {
    await expect(place({ wilayaCode: 37, deliveryType: "stopdesk" })).rejects.toThrow(
      "La livraison au bureau (stop desk) n'est pas disponible dans la wilaya de Tindouf.",
    );
  });

  it("checks color and stock against the product", async () => {
    await expect(place({ color: "Rose" })).rejects.toThrow(
      "Cette couleur n'est pas disponible pour ce produit.",
    );
    // Canvas Hoodie: 2 left in S. Silence Hoodie: XXL sold out.
    await expect(
      place({ productId: "prod_009", color: "Anthracite", size: "S", quantity: 3 }),
    ).rejects.toThrow("Il ne reste que 2 articles en taille S.");
    await expect(place({ productId: "prod_006", size: "XXL" })).rejects.toThrow(
      "La taille XXL est épuisée.",
    );
  });
});
