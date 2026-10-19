import { refineVariantStock, type Size } from "@rassm/shared";
import { z } from "zod";
import { HttpError, issuesToFields } from "../lib/http-error";
import { ProductModel, toProduct, type ProductDoc } from "../models/product";

// Stock per variant (color + size). Every change is a single conditional update, so two
// requests can never take the same last unit.

export interface Variant {
  productId: string;
  color: string;
  size: Size;
  quantity: number;
}

export const PRODUCT_UNAVAILABLE = "Ce produit n'est plus disponible.";
const STOCK_CHANGED =
  "Le stock de cet article vient de changer : vérifiez la couleur, la taille et la quantité.";

/** The product as stored (on sale only, unless `includeInactive`). */
export async function loadProduct(productId: string, { includeInactive = false } = {}) {
  const doc = await ProductModel.findOne({
    _id: productId,
    ...(includeInactive ? {} : { isActive: true }),
  }).lean<ProductDoc>();
  return doc ? toProduct(doc) : null;
}

/**
 * Takes `quantity` units of this color + size, only if enough are left. `includeInactive`
 * lets the team adjust orders of a product taken off sale.
 */
export async function reserveStock(
  variant: Variant,
  { includeInactive = false } = {},
): Promise<boolean> {
  if (variant.quantity <= 0) return true;
  const { matchedCount } = await ProductModel.updateOne(
    {
      _id: variant.productId,
      ...(includeInactive ? {} : { isActive: true }),
      colors: {
        $elemMatch: { name: variant.color, [`stock.${variant.size}`]: { $gte: variant.quantity } },
      },
    },
    { $inc: { [`colors.$.stock.${variant.size}`]: -variant.quantity } },
  );
  return matchedCount === 1;
}

/** Gives `quantity` units of this color + size back. */
export async function releaseStock(variant: Variant): Promise<void> {
  if (variant.quantity <= 0) return;
  await ProductModel.updateOne(
    { _id: variant.productId, "colors.name": variant.color },
    { $inc: { [`colors.$.stock.${variant.size}`]: variant.quantity } },
  );
}

/**
 * French 409 for a variant that is not available in this quantity, from the current
 * stock. `heldQuantity`: units of this same variant the order already holds (edits).
 */
export async function stockError(
  variant: Variant,
  { heldQuantity = 0, includeInactive = false } = {},
): Promise<HttpError> {
  const product = await loadProduct(variant.productId, { includeInactive });
  if (!product) return new HttpError(409, PRODUCT_UNAVAILABLE, { productId: PRODUCT_UNAVAILABLE });
  const withHeld = {
    ...product,
    colors: product.colors.map((color) =>
      color.name === variant.color
        ? {
            ...color,
            stock: { ...color.stock, [variant.size]: color.stock[variant.size] + heldQuantity },
          }
        : color,
    ),
  };
  const result = z
    .object({ color: z.string(), size: z.string(), quantity: z.number() })
    .superRefine(refineVariantStock(withHeld))
    .safeParse(variant);
  const fields = result.success ? { quantity: STOCK_CHANGED } : issuesToFields(result.error.issues);
  return new HttpError(409, Object.values(fields)[0] ?? STOCK_CHANGED, fields);
}
