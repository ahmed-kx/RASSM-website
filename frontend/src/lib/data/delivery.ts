import { API_PATHS, WILAYAS, deliveryFeeSchema, type DeliveryFee } from "@rassm/shared";
import { z } from "zod";
import { apiGet } from "@/lib/api";

// Data access for the delivery fee table (Anderson rates), from the API.

/** The rates change rarely: Next asks the API again after 5 minutes. */
const DELIVERY_FEES_REVALIDATE = 300;

const deliveryFeesResponseSchema = z.object({ deliveryFees: z.array(deliveryFeeSchema) });

export async function getDeliveryFees(): Promise<DeliveryFee[]> {
  const data = await apiGet(API_PATHS.deliveryFees, deliveryFeesResponseSchema, {
    revalidate: DELIVERY_FEES_REVALIDATE,
  });
  return data?.deliveryFees ?? [];
}

/** One row of the public delivery table: a wilaya and its rates. */
export interface DeliveryRate extends DeliveryFee {
  wilayaName: string;
}

/** The 58 wilayas with their delivery rates, in wilaya code order. */
export async function getDeliveryRates(): Promise<DeliveryRate[]> {
  const fees = await getDeliveryFees();
  return WILAYAS.flatMap((wilaya) => {
    const fee = fees.find((item) => item.wilayaCode === wilaya.code);
    return fee ? [{ ...fee, wilayaName: wilaya.name }] : [];
  });
}
