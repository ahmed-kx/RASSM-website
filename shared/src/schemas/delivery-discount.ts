import { z } from "zod";
import { formatPrice } from "../utils/format-price";
import { categorySchema, idSchema, priceDaSchema } from "./common";

export const MAX_DELIVERY_DISCOUNT_TIERS = 5;

/** "1 article", "3 articles" */
function articles(count: number): string {
  return `${count} article${count > 1 ? "s" : ""}`;
}

const minQuantitySchema = z
  .number({ error: "La quantité minimum doit être un nombre." })
  .int("La quantité minimum doit être un nombre entier.")
  .min(1, "La quantité minimum doit être d'au moins 1 article.");

/**
 * One delivery discount tier: from `minQuantity` units of the product, either
 * `amount` DA off delivery, or free delivery.
 */
export const deliveryDiscountTierSchema = z.discriminatedUnion(
  "type",
  [
    z.object({
      type: z.literal("amount"),
      minQuantity: minQuantitySchema,
      amount: z
        .number({ error: "Le montant de la réduction doit être un nombre." })
        .int("Le montant de la réduction doit être un nombre entier de dinars.")
        .positive("Le montant de la réduction doit être supérieur à 0 DA."),
    }),
    z.object({
      type: z.literal("free"),
      minQuantity: minQuantitySchema,
    }),
  ],
  { error: "Choisissez le type de réduction : montant ou livraison gratuite." },
);
export type DeliveryDiscountTier = z.infer<typeof deliveryDiscountTierSchema>;

/** A product's tiers, in any order. Empty (the default) means no delivery discount. */
export const deliveryDiscountTiersSchema = z
  .array(deliveryDiscountTierSchema)
  .max(
    MAX_DELIVERY_DISCOUNT_TIERS,
    `Un produit peut avoir au maximum ${MAX_DELIVERY_DISCOUNT_TIERS} paliers de réduction.`,
  )
  .superRefine((tiers, ctx) => {
    const seen = new Set<number>();
    tiers.forEach((tier, index) => {
      if (seen.has(tier.minQuantity)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "minQuantity"],
          message: `Deux paliers ne peuvent pas avoir la même quantité minimum (${tier.minQuantity}).`,
        });
      }
      seen.add(tier.minQuantity);
    });

    // Sorted by minQuantity, each tier must give strictly more than the previous one,
    // and "free" can only be the last tier.
    const sorted = tiers
      .map((tier, index) => ({ tier, index }))
      .sort((a, b) => a.tier.minQuantity - b.tier.minQuantity);
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      if (!previous || !current || previous.tier.minQuantity === current.tier.minQuantity) {
        continue;
      }
      if (previous.tier.type === "free") {
        ctx.addIssue({
          code: "custom",
          path: [previous.index, "type"],
          message: `La livraison gratuite doit être le dernier palier : le palier de ${articles(current.tier.minQuantity)} ne peut pas venir après celui de ${articles(previous.tier.minQuantity)}.`,
        });
      } else if (current.tier.type === "amount" && current.tier.amount <= previous.tier.amount) {
        ctx.addIssue({
          code: "custom",
          path: [current.index, "amount"],
          message: `Le palier de ${articles(current.tier.minQuantity)} doit donner une réduction plus grande que celui de ${articles(previous.tier.minQuantity)} (${formatPrice(previous.tier.amount)}).`,
        });
      }
    }
  })
  .default([]);

/** The tier applied to one product of the cart (stored on the order for statistics). */
export const deliveryDiscountLineSchema = z.object({
  productId: idSchema,
  productName: z.string().min(1),
  /** Units of this product in the cart, all sizes together. */
  quantity: z.number().int().positive(),
  tier: deliveryDiscountTierSchema,
  /**
   * What this tier is worth on its own, before the cap: the tier amount, or the
   * whole base fee for a "free" tier.
   */
  amount: priceDaSchema,
});
export type DeliveryDiscountLine = z.infer<typeof deliveryDiscountLineSchema>;

/** A better tier the customer has not reached yet, for "Ajoutez 1 sweatshirt..." messages. */
export const nextDeliveryDiscountTierSchema = z.object({
  productId: idSchema,
  productName: z.string().min(1),
  category: categorySchema,
  quantity: z.number().int().nonnegative(),
  /** Units still to add to reach `tier`. */
  missingQuantity: z.number().int().positive(),
  tier: deliveryDiscountTierSchema,
});
export type NextDeliveryDiscountTier = z.infer<typeof nextDeliveryDiscountTierSchema>;
