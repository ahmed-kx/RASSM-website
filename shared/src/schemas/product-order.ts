import { z } from "zod";
import { idSchema, sizeSchema } from "./common";
import { customerFieldsSchema, refineAddressForHomeDelivery } from "./customer";
import { wilayaCodeSchema } from "./delivery";

/** Most units of one product (one color, one size) in a single order. */
export const MAX_QUANTITY_PER_ORDER = 10;

export const COLOR_REQUIRED_MESSAGE = "Veuillez choisir une couleur.";
export const SIZE_REQUIRED_MESSAGE = "Veuillez choisir une taille.";
const WILAYA_REQUIRED_MESSAGE = "Veuillez choisir votre wilaya.";

export const orderQuantitySchema = z
  .number({ error: "La quantité doit être un nombre." })
  .int("La quantité doit être un nombre entier.")
  .min(1, "La quantité doit être d'au moins 1.")
  .max(
    MAX_QUANTITY_PER_ORDER,
    `Vous pouvez commander au maximum ${MAX_QUANTITY_PER_ORDER} exemplaires du même article.`,
  );

/** Color name, as listed on the product (e.g. "Noir"). */
const orderColorSchema = z
  .string({ error: COLOR_REQUIRED_MESSAGE })
  .trim()
  .min(1, COLOR_REQUIRED_MESSAGE)
  .max(40, COLOR_REQUIRED_MESSAGE);

/** Plain object with every order field (no cross-field rule), for reuse in other schemas. */
export const productOrderFieldsSchema = customerFieldsSchema.extend({
  productId: idSchema,
  color: orderColorSchema,
  size: z.enum(sizeSchema.options, { error: SIZE_REQUIRED_MESSAGE }),
  quantity: orderQuantitySchema,
});

/**
 * An order placed from a product page (one product, one color, one size): what the
 * frontend sends and what the backend validates. Cash on delivery only.
 * Stock, color and the delivery fee are checked against the product and the fee
 * table by whoever receives it, never trusted from the client.
 */
export const productOrderSchema = productOrderFieldsSchema.superRefine(
  refineAddressForHomeDelivery,
);
export type ProductOrder = z.output<typeof productOrderSchema>;

/**
 * The same rules for the product page form, whose selects start empty: the wilaya is
 * the <select> value (a string) and the size is "" until chosen. The output is a
 * `ProductOrder`.
 */
export const productOrderFormSchema = productOrderFieldsSchema
  .extend({
    wilayaCode: z
      .string({ error: WILAYA_REQUIRED_MESSAGE })
      .trim()
      .min(1, WILAYA_REQUIRED_MESSAGE)
      .transform(Number)
      .pipe(wilayaCodeSchema),
    size: z
      .string({ error: SIZE_REQUIRED_MESSAGE })
      .min(1, SIZE_REQUIRED_MESSAGE)
      .pipe(z.enum(sizeSchema.options, { error: SIZE_REQUIRED_MESSAGE })),
  })
  .superRefine(refineAddressForHomeDelivery);

/** Values the form holds before validation. */
export type ProductOrderFormValues = z.input<typeof productOrderFormSchema>;
