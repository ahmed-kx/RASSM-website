import { z } from "zod";
import { WILAYA_COUNT, getWilaya } from "../constants/wilayas";
import { priceDaSchema } from "./common";

export const wilayaCodeSchema = z
  .number({ error: "Veuillez choisir votre wilaya." })
  .int("Veuillez choisir votre wilaya.")
  .min(1, "Veuillez choisir votre wilaya.")
  // Codes are contiguous (1 to 58), so a range check is enough.
  .max(WILAYA_COUNT, "Veuillez choisir votre wilaya.");

export const DELIVERY_TYPES = ["home", "stopdesk"] as const;
export const deliveryTypeSchema = z.enum(DELIVERY_TYPES, {
  error: "Choisissez le mode de livraison : à domicile ou au bureau.",
});
export type DeliveryType = z.infer<typeof deliveryTypeSchema>;

/** French labels for the order form ("Au bureau" = pickup at the courier's stop desk). */
export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  home: "À domicile",
  stopdesk: "Au bureau",
};

export const deliveryFeeSchema = z.object({
  wilayaCode: wilayaCodeSchema,
  /** Home delivery price in DA. */
  homePrice: priceDaSchema,
  /** Stop-desk (pickup point) price in DA, or null when the wilaya has no stop desk. */
  stopDeskPrice: priceDaSchema.nullable(),
  /** Estimated delivery time in days, from Alger. */
  estimatedDays: z
    .number({ error: "Le délai de livraison doit être un nombre." })
    .int("Le délai de livraison doit être un nombre entier de jours.")
    .min(1, "Le délai de livraison doit être d'au moins 1 jour."),
  /**
   * Delivery paused in this wilaya (set in the dashboard): customers cannot choose it and the
   * API refuses its orders. Missing = active.
   */
  suspended: z.boolean().default(false),
});
export type DeliveryFee = z.infer<typeof deliveryFeeSchema>;

/** Shown next to a suspended wilaya and returned by the API for its orders. */
export const WILAYA_SUSPENDED_MESSAGE = "Livraison temporairement indisponible dans cette wilaya.";

/** Short label in the wilaya select of the order form. */
export const WILAYA_SUSPENDED_LABEL = "Livraison temporairement indisponible";

// ---------- Dashboard: delivery prices ----------

const positivePriceSchema = (label: string) =>
  z
    .number({ error: `Le prix ${label} doit être un nombre.` })
    .int(`Le prix ${label} doit être un nombre entier de dinars.`)
    .positive(`Le prix ${label} doit être supérieur à 0 DA.`)
    .max(50_000, `Le prix ${label} semble trop élevé.`);

/** Changes of one wilaya in the dashboard (prices, delay, stop desk, suspension). */
export const deliveryFeeUpdateSchema = z.object({
  homePrice: positivePriceSchema("à domicile"),
  /** Null = no stop desk in this wilaya (home delivery only). */
  stopDeskPrice: positivePriceSchema("au bureau").nullable(),
  estimatedDays: z
    .number({ error: "Le délai doit être un nombre de jours." })
    .int("Le délai doit être un nombre entier de jours.")
    .min(1, "Le délai doit être d'au moins 1 jour.")
    .max(30, "Le délai ne doit pas dépasser 30 jours."),
  suspended: z.boolean(),
});
export type DeliveryFeeUpdate = z.infer<typeof deliveryFeeUpdateSchema>;

const wilayaCodesSchema = z
  .array(wilayaCodeSchema)
  .min(1, "Sélectionnez au moins une wilaya.")
  .max(WILAYA_COUNT);

/** Bulk action on selected wilayas: change every price by ± amount, suspend or reactivate. */
export const deliveryBulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("adjust"),
    codes: wilayaCodesSchema,
    amount: z
      .number({ error: "Indiquez un montant en DA." })
      .int("Le montant doit être un nombre entier de dinars.")
      .refine((amount) => amount !== 0, "Le montant ne peut pas être 0 DA.")
      .refine((amount) => Math.abs(amount) <= 10_000, "Le montant semble trop élevé."),
  }),
  z.object({ action: z.literal("suspend"), codes: wilayaCodesSchema }),
  z.object({ action: z.literal("reactivate"), codes: wilayaCodesSchema }),
]);
export type DeliveryBulk = z.infer<typeof deliveryBulkSchema>;

/**
 * A product discount tier that a price change would make invalid (its amount must stay lower
 * than the highest home delivery price).
 */
export const tierWarningSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  amount: z.number().int(),
  maxHomePrice: z.number().int(),
});
export type TierWarning = z.infer<typeof tierWarningSchema>;

export const adminDeliveryFeesSchema = z.object({
  deliveryFees: z.array(deliveryFeeSchema),
  /** Tiers that are (or would be, for a preview) no longer valid. */
  warnings: z.array(tierWarningSchema),
});
export type AdminDeliveryFees = z.infer<typeof adminDeliveryFeesSchema>;

/** Delivery types offered in a wilaya (home is always available). */
export function getAvailableDeliveryTypes(fee: DeliveryFee): DeliveryType[] {
  return fee.stopDeskPrice === null ? ["home"] : ["home", "stopdesk"];
}

/** Thrown when the customer picks stop desk in a wilaya that has none. */
export class DeliveryTypeUnavailableError extends Error {
  constructor(
    readonly wilayaCode: number,
    readonly deliveryType: DeliveryType,
  ) {
    const wilaya = getWilaya(wilayaCode);
    super(
      `La livraison au bureau (stop desk) n'est pas disponible dans la wilaya ${wilaya ? `de ${wilaya.name}` : wilayaCode}. Choisissez la livraison à domicile.`,
    );
    this.name = "DeliveryTypeUnavailableError";
  }
}

/** Price for a delivery type. Throws `DeliveryTypeUnavailableError` if it is not offered. */
export function getDeliveryPrice(fee: DeliveryFee, type: DeliveryType): number {
  const price = type === "home" ? fee.homePrice : fee.stopDeskPrice;
  if (price === null) {
    throw new DeliveryTypeUnavailableError(fee.wilayaCode, type);
  }
  return price;
}
