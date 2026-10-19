import type { PlacedOrder, ProductOrder } from "@rassm/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderError, getLastOrder, placeProductOrder } from "./orders";

// Pricing, stock and fraud checks are tested in the backend (backend/test/orders.test.ts).
// Here: what the frontend sends, how it reads the answer and the French errors.

const order: ProductOrder = {
  productId: "prod_003",
  color: "Noir",
  size: "M",
  quantity: 2,
  fullName: "Yacine Benali",
  phone: "0555123456",
  wilayaCode: 16,
  commune: "Bab Ezzouar",
  deliveryType: "home",
  address: "Cité 1200 logements, bâtiment 5",
};

const { productId: _p, color: _c, size: _s, quantity: _q, ...customer } = order;

const placed: PlacedOrder = {
  eventId: "6710f0c2a1b2c3d4e5f60718",
  order: {
    ...customer,
    item: {
      productId: "prod_003",
      color: "Noir",
      size: "M",
      quantity: 2,
      name: "Fragment Sweatshirt",
      slug: "fragment-sweatshirt",
      image: "/images/products/fragment-sweatshirt-front.jpg",
      unitPrice: 6900,
    },
    subtotal: 13800,
    deliveryFeeBase: 400,
    deliveryDiscount: 200,
    deliveryFee: 200,
    freeDelivery: false,
    deliveryDiscountLines: [
      {
        productId: "prod_003",
        productName: "Fragment Sweatshirt",
        quantity: 2,
        tier: { type: "amount", minQuantity: 2, amount: 200 },
        amount: 200,
      },
    ],
    total: 14000,
    status: "pending",
    paymentMethod: "cash_on_delivery",
    createdAt: "2026-10-19T10:00:00.000Z",
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("placeProductOrder", () => {
  it("posts the customer's choices only (no price), with the honeypot and Meta data", async () => {
    const fetchMock = vi.fn(async () => json(201, placed));
    vi.stubGlobal("fetch", fetchMock);

    const result = await placeProductOrder(order, {
      website: "",
      tracking: { fbp: "fb.1.1712345678901.123456789" },
    });

    expect(result).toEqual(placed);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/orders$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      order,
      website: "",
      tracking: { fbp: "fb.1.1712345678901.123456789" },
    });
    expect(String(init.body)).not.toMatch(/price|total|deliveryFee/i);
  });

  it("keeps the answer for /merci (no order number in it)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(201, placed)),
    );
    await placeProductOrder(order);
    expect(await getLastOrder()).toEqual(placed);
    expect(JSON.stringify(await getLastOrder())).not.toMatch(/RSM-\d/);
  });

  it("throws the server's French errors with their field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(409, {
          error: {
            message: "La taille M est épuisée en Noir.",
            fields: { size: "La taille M est épuisée en Noir." },
          },
        }),
      ),
    );
    const error = await placeProductOrder(order).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OrderError);
    expect(error).toMatchObject({
      message: "La taille M est épuisée en Noir.",
      fields: { size: "La taille M est épuisée en Noir." },
    });
  });

  it("explains a network failure in French", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(placeProductOrder(order)).rejects.toThrow(
      "Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.",
    );
  });
});
