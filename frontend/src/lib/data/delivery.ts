import type { DeliveryFee } from "@rassm/shared";
import { mockDeliveryFees } from "@rassm/shared/mocks";

// Data access for the delivery fee table (Anderson rates). Mocks today, the API later.

export async function getDeliveryFees(): Promise<DeliveryFee[]> {
  return [...mockDeliveryFees];
}
