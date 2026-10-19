import { z } from "zod";
import { idSchema, imageUrlSchema, priceDaSchema, sizeSchema, slugSchema } from "./common";

export const MAX_QUANTITY_PER_ITEM = 10;

export const cartItemSchema = z.object({
  productId: idSchema,
  name: z.string().trim().min(1, "Nom du produit manquant."),
  slug: slugSchema,
  image: imageUrlSchema,
  size: sizeSchema,
  quantity: z
    .number()
    .int("La quantité doit être un nombre entier.")
    .min(1, "La quantité doit être d'au moins 1.")
    .max(
      MAX_QUANTITY_PER_ITEM,
      `Vous pouvez commander au maximum ${MAX_QUANTITY_PER_ITEM} exemplaires du même article.`,
    ),
  /** Unit price in DA at the time the item was added. */
  unitPrice: priceDaSchema,
});
export type CartItem = z.infer<typeof cartItemSchema>;

export function getCartSubtotal(items: readonly CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}
