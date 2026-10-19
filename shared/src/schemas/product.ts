import { z } from "zod";
import {
  categorySchema,
  hexColorSchema,
  idSchema,
  imageUrlSchema,
  isoDateSchema,
  priceDaSchema,
  sizeSchema,
  slugSchema,
} from "./common";
import { deliveryDiscountTiersSchema } from "./delivery-discount";
import { formatPrice } from "../utils/format-price";

export const productColorSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la couleur est obligatoire."),
  hex: hexColorSchema,
});
export type ProductColor = z.infer<typeof productColorSchema>;

/** Units in stock for every size. All five sizes must be present (0 = sold out). */
export const stockBySizeSchema = z.record(
  sizeSchema,
  z
    .number()
    .int("Le stock doit être un nombre entier.")
    .nonnegative("Le stock ne peut pas être négatif."),
);
export type StockBySize = z.infer<typeof stockBySizeSchema>;

export const productSchema = z.object({
  id: idSchema,
  name: z
    .string()
    .trim()
    .min(2, "Le nom du produit est trop court.")
    .max(80, "Le nom du produit ne doit pas dépasser 80 caractères."),
  slug: slugSchema,
  description: z
    .string()
    .trim()
    .min(10, "La description est trop courte.")
    .max(2000, "La description ne doit pas dépasser 2 000 caractères."),
  category: categorySchema,
  /** Price in DA (integer). */
  price: priceDaSchema.positive("Le prix doit être supérieur à 0."),
  images: z.array(imageUrlSchema).min(1, "Un produit doit avoir au moins une image."),
  colors: z.array(productColorSchema).min(1, "Un produit doit avoir au moins une couleur."),
  stock: stockBySizeSchema,
  featured: z.boolean(),
  isActive: z.boolean(),
  /**
   * Quantity-based delivery discount tiers (empty = none). They reduce the delivery
   * fee only, never the product price. See `getDeliveryFeeWithDiscount`.
   */
  deliveryDiscountTiers: deliveryDiscountTiersSchema,
  /** Collection drop label, e.g. "Drop 001". */
  drop: z.string().regex(/^Drop \d{3}$/, 'Le drop doit avoir la forme "Drop 001".'),
  createdAt: isoDateSchema,
});
export type Product = z.infer<typeof productSchema>;

/**
 * Product schema that also checks every tier amount is lower than the highest home
 * delivery price. Use it wherever products are created or edited (admin form, API,
 * mocks), passing `getMaxHomeDeliveryPrice(deliveryFees)`. Never hard-code the limit.
 */
export function createProductSchema(maxHomeDeliveryPrice: number) {
  return productSchema.superRefine((product, ctx) => {
    product.deliveryDiscountTiers.forEach((tier, index) => {
      if (tier.type === "amount" && tier.amount >= maxHomeDeliveryPrice) {
        ctx.addIssue({
          code: "custom",
          path: ["deliveryDiscountTiers", index, "amount"],
          message: `Le montant de la réduction doit être inférieur au tarif de livraison à domicile le plus élevé (${formatPrice(maxHomeDeliveryPrice)}).`,
        });
      }
    });
  });
}
