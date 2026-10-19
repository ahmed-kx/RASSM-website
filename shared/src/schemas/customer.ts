import { z } from "zod";
import { deliveryTypeSchema, wilayaCodeSchema } from "./delivery";

/** Algerian mobile: 05, 06 or 07 followed by 8 digits (10 digits total). */
export const ALGERIAN_MOBILE_REGEX = /^0[567]\d{8}$/;

/** Accepts "0555 12 34 56", "0555-12-34-56" or "0555123456" and normalises to digits only. */
export const algerianPhoneSchema = z
  .string({ error: "Veuillez entrer votre numéro de téléphone." })
  .trim()
  .min(1, "Veuillez entrer votre numéro de téléphone.")
  .transform((value) => value.replace(/[\s.-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        ALGERIAN_MOBILE_REGEX,
        "Numéro invalide : il doit commencer par 05, 06 ou 07 et contenir 10 chiffres (ex. 0555 12 34 56).",
      ),
  );

/** Who receives the order and where. Shared by the order form and the stored Order. */
export const customerFieldsSchema = z.object({
  fullName: z
    .string({ error: "Veuillez entrer votre nom complet." })
    .trim()
    .min(3, "Veuillez entrer votre nom complet (3 caractères minimum).")
    .max(80, "Le nom ne doit pas dépasser 80 caractères."),
  phone: algerianPhoneSchema,
  wilayaCode: wilayaCodeSchema,
  commune: z
    .string({ error: "Veuillez entrer votre commune." })
    .trim()
    .min(2, "Veuillez entrer votre commune.")
    .max(80, "Le nom de la commune est trop long."),
  /** Required for home delivery, optional for stop desk (see `refineAddressForHomeDelivery`). */
  address: z.string().trim().max(200, "L'adresse ne doit pas dépasser 200 caractères."),
  deliveryType: deliveryTypeSchema,
});
export type CustomerFields = z.infer<typeof customerFieldsSchema>;

export const ADDRESS_REQUIRED_MESSAGE =
  "Veuillez entrer votre adresse complète pour la livraison à domicile.";

/** The address is required for home delivery only. */
export function refineAddressForHomeDelivery(
  data: Pick<CustomerFields, "address" | "deliveryType">,
  ctx: z.RefinementCtx,
): void {
  if (data.deliveryType === "home" && data.address.trim().length < 5) {
    ctx.addIssue({ code: "custom", path: ["address"], message: ADDRESS_REQUIRED_MESSAGE });
  }
}
