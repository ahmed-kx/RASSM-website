import { describe, expect, it } from "vitest";
import { getMockProductBySlug } from "../mocks";
import { getSizeStock, getVariantStock, isProductInStock, productColorSchema } from "./product";
import {
  createProductOrderFormSchema,
  createProductOrderSchema,
  type ProductOrder,
} from "./product-order";

const found = getMockProductBySlug("classic-tee");
if (!found) throw new Error("Missing mock product classic-tee.");
const classicTee = found;
// Classic Tee: Noir { S 10, M 20, L 20, XL 12, XXL 6 }, Crème { S 4, M 0, L 3, XL 2, XXL 0 }.

const order: ProductOrder = {
  productId: classicTee.id,
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

function issues(values: Partial<ProductOrder>): Record<string, string> {
  const result = createProductOrderSchema(classicTee).safeParse({ ...order, ...values });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("stock per color and size", () => {
  it("reads the stock of each variant", () => {
    expect(getVariantStock(classicTee, "Noir", "M")).toBe(20);
    expect(getVariantStock(classicTee, "Crème", "M")).toBe(0);
    expect(getVariantStock(classicTee, "Rose", "M")).toBe(0);
    expect(getSizeStock(classicTee, "XXL")).toBe(6);
    expect(isProductInStock(classicTee)).toBe(true);
  });

  it("accepts an available variant", () => {
    expect(issues({})).toEqual({});
    expect(issues({ color: "Crème", size: "L", quantity: 3 })).toEqual({});
  });

  it("rejects a sold-out combination even if the size exists in another color", () => {
    expect(issues({ color: "Crème", size: "M" })).toEqual({
      size: "La taille M est épuisée en Crème.",
    });
  });

  it("rejects a quantity above the variant stock", () => {
    expect(issues({ color: "Crème", size: "L", quantity: 4 })).toEqual({
      quantity: "Il ne reste que 3 articles en taille L (Crème).",
    });
    // The same quantity is fine in Noir.
    expect(issues({ color: "Noir", size: "L", quantity: 4 })).toEqual({});
  });

  it("rejects a color the product does not have", () => {
    expect(issues({ color: "Rose" })).toEqual({
      color: "Cette couleur n'est pas disponible pour ce produit.",
    });
  });

  it("the form schema reports the variant error under the size", () => {
    const result = createProductOrderFormSchema(classicTee).safeParse({
      ...order,
      wilayaCode: "16",
      color: "Crème",
      size: "M",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => [issue.path.join("."), issue.message])).toEqual([
      ["size", "La taille M est épuisée en Crème."],
    ]);
  });

  it("requires a stock entry for every size of every color, in French", () => {
    const result = productColorSchema.safeParse({
      name: "Noir",
      hex: "#111111",
      stock: { S: 1, M: 2, L: -1, XL: 1.5 },
    });
    expect(result.error?.issues.map((issue) => [issue.path.join("."), issue.message])).toEqual([
      ["stock.L", "Le stock de la taille L ne peut pas être négatif."],
      ["stock.XL", "Le stock de la taille XL doit être un nombre entier."],
      [
        "stock.XXL",
        "Stock manquant pour la taille XXL : indiquez 0 si elle n'est pas vendue ou épuisée.",
      ],
    ]);
    expect(
      productColorSchema.safeParse({ name: "Noir", hex: "#111111" }).error?.issues[0],
    ).toMatchObject({
      path: ["stock"],
      message: "Indiquez le stock de chaque taille pour cette couleur.",
    });
  });
});
