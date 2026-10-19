import { WILAYAS, type DeliveryFee } from "@rassm/shared";
import { mockDeliveryFees } from "@rassm/shared/mocks";

// Data access for the delivery fee table (Anderson rates). Mocks today, the API later.

export async function getDeliveryFees(): Promise<DeliveryFee[]> {
  return [...mockDeliveryFees];
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
