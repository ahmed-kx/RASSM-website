import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  adminSettingsUpdateSchema,
  getProductStatus,
  getStockLevel,
  isLowVariantStock,
} from "./admin-product";

const stock = (S: number, M = 0, L = 0, XL = 0, XXL = 0) => ({ S, M, L, XL, XXL });
const product = (stocks: ReturnType<typeof stock>[], isActive = true) => ({
  isActive,
  colors: stocks.map((s, index) => ({ name: `Couleur ${index}`, hex: "#111111", stock: s })),
});

describe("product status from the total stock", () => {
  it("is Rupture at 0 units, Stock faible at or below the threshold, Actif above", () => {
    expect(getProductStatus(product([stock(0)]), 10)).toBe("out");
    expect(getProductStatus(product([stock(1)]), 10)).toBe("low");
    expect(getProductStatus(product([stock(4), stock(3, 3)]), 10)).toBe("low");
    expect(getProductStatus(product([stock(4), stock(4, 3)]), 10)).toBe("active");
  });

  it("ignores a low variant when the total is above the threshold", () => {
    // One size with a single unit, but 21 units in total.
    expect(getStockLevel(product([stock(1, 10, 10)]), DEFAULT_LOW_STOCK_THRESHOLD)).toBe("ok");
    expect(isLowVariantStock(1)).toBe(true);
    expect(isLowVariantStock(3)).toBe(true);
    expect(isLowVariantStock(0)).toBe(false);
    expect(isLowVariantStock(4)).toBe(false);
  });

  it("follows the threshold set in the dashboard", () => {
    const p = product([stock(5, 5, 5)]);
    expect(getStockLevel(p, 10)).toBe("ok");
    expect(getStockLevel(p, 15)).toBe("low");
    expect(getStockLevel(p, 0)).toBe("ok");
  });

  it("shows Masqué first for a hidden product", () => {
    expect(getProductStatus(product([stock(0)], false), 10)).toBe("hidden");
  });

  it("validates the threshold with French messages", () => {
    expect(adminSettingsUpdateSchema.safeParse({ lowStockThreshold: 10 }).success).toBe(true);
    const negative = adminSettingsUpdateSchema.safeParse({ lowStockThreshold: -1 });
    expect(negative.error?.issues[0]?.message).toBe("Le seuil ne peut pas être négatif.");
    const decimal = adminSettingsUpdateSchema.safeParse({ lowStockThreshold: 2.5 });
    expect(decimal.error?.issues[0]?.message).toBe("Indiquez un nombre entier d'unités.");
  });
});
