import { describe, expect, it } from "vitest";
import {
  productOrderFormSchema,
  productOrderSchema,
  type ProductOrderFormValues,
} from "./product-order";

const valid: ProductOrderFormValues = {
  productId: "prod_003",
  color: "Noir",
  size: "M",
  quantity: 2,
  fullName: "Yacine Benali",
  phone: "0555 12 34 56",
  wilayaCode: "16",
  commune: "Bab Ezzouar",
  deliveryType: "home",
  address: "Cité 1200 logements, bâtiment 5",
};

function errors(values: Partial<ProductOrderFormValues>): Record<string, string> {
  const result = productOrderFormSchema.safeParse({ ...valid, ...values });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("productOrderFormSchema", () => {
  it("accepts a valid order and normalises it", () => {
    const result = productOrderFormSchema.parse(valid);
    expect(result).toMatchObject({ wilayaCode: 16, phone: "0555123456", size: "M" });
    // The output is a valid API payload.
    expect(productOrderSchema.safeParse(result).success).toBe(true);
  });

  it("requires a color and a size, with French messages", () => {
    expect(errors({ color: "", size: "" })).toEqual({
      color: "Veuillez choisir une couleur.",
      size: "Veuillez choisir une taille.",
    });
    expect(errors({ size: "XXXL" })).toEqual({ size: "Veuillez choisir une taille." });
  });

  it("requires a wilaya from the 58", () => {
    expect(errors({ wilayaCode: "" })).toEqual({ wilayaCode: "Veuillez choisir votre wilaya." });
    expect(errors({ wilayaCode: "59" })).toEqual({ wilayaCode: "Veuillez choisir votre wilaya." });
  });

  it("checks the Algerian phone format", () => {
    expect(errors({ phone: "0455123456" }).phone).toMatch(/^Numéro invalide/);
    expect(errors({ phone: "055512345" }).phone).toMatch(/^Numéro invalide/);
    expect(errors({ phone: "07-77-12-34-56" })).toEqual({});
  });

  it("requires the address for home delivery only", () => {
    expect(errors({ address: "" })).toEqual({
      address: "Veuillez entrer votre adresse complète pour la livraison à domicile.",
    });
    expect(errors({ address: "", deliveryType: "stopdesk" })).toEqual({});
  });

  it("limits the quantity to 1–10", () => {
    expect(errors({ quantity: 0 }).quantity).toBe("La quantité doit être d'au moins 1.");
    expect(errors({ quantity: 11 }).quantity).toBe(
      "Vous pouvez commander au maximum 10 exemplaires du même article.",
    );
  });

  it("reports every missing field at once", () => {
    expect(
      Object.keys(
        errors({
          fullName: "",
          phone: "",
          wilayaCode: "",
          commune: "",
          address: "",
          color: "",
          size: "",
        }),
      ).sort(),
    ).toEqual(["address", "color", "commune", "fullName", "phone", "size", "wilayaCode"]);
  });
});
