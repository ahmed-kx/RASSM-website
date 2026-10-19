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
  error: "Choisissez livraison à domicile ou stop desk.",
});
export type DeliveryType = z.infer<typeof deliveryTypeSchema>;

/** French labels for the checkout UI. */
export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  home: "Livraison à domicile",
  stopdesk: "Retrait au stop desk",
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
});
export type DeliveryFee = z.infer<typeof deliveryFeeSchema>;

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
      `Le retrait au stop desk n'est pas disponible dans la wilaya ${wilaya ? `de ${wilaya.name}` : wilayaCode}. Choisissez la livraison à domicile.`,
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
