import { z } from "zod";
import { deliveryTypeSchema, wilayaCodeSchema } from "./delivery";

/** Algerian mobile: 05, 06 or 07 followed by 8 digits (10 digits total). */
export const ALGERIAN_MOBILE_REGEX = /^0[567]\d{8}$/;

/**
 * One way of writing each number, so duplicates, fraud counts and the blacklist always match:
 * spaces, dots, dashes and brackets removed, Arabic digits (٠١٢…) turned into 0-9, and the
 * international forms +213 / 00213 / 213 turned into the national 0 ("+213 555 12 34 56",
 * "00213555123456" and "0555-12-34-56" all give "0555123456"). Anything else is kept as typed
 * (the schema then refuses it).
 */
export function normalizeAlgerianPhone(value: string): string {
  const digits = value
    .trim()
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\s.\-()]/g, "");
  const international = /^(?:\+|00)?213(?:0)?([567]\d{8})$/.exec(digits);
  return international ? `0${international[1]}` : digits;
}

/** Accepts "0555 12 34 56", "+213 555 12 34 56"… and normalises to "0555123456". */
export const algerianPhoneSchema = z
  .string({ error: "Veuillez entrer votre numéro de téléphone." })
  .trim()
  .min(1, "Veuillez entrer votre numéro de téléphone.")
  .transform(normalizeAlgerianPhone)
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
