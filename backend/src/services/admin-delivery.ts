import {
  formatPrice,
  getMaxHomeDeliveryPrice,
  getWilaya,
  type AdminDeliveryFees,
  type DeliveryBulk,
  type DeliveryFee,
  type DeliveryFeeUpdate,
  type TierWarning,
} from "@rassm/shared";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";
import type { Revalidator } from "../lib/revalidate";
import { DeliveryFeeModel, loadDeliveryFees } from "../models/delivery-fee";
import { ProductModel, type ProductDoc } from "../models/product";

// Dashboard delivery prices (design/admin-delivery.png). A preview (dryRun) returns the table
// and the warnings without saving, so the dashboard can show them before confirming.

/** Product tiers whose amount is not lower than the highest home price of `fees`. */
async function tierWarnings(fees: readonly DeliveryFee[]): Promise<TierWarning[]> {
  const maxHomePrice = getMaxHomeDeliveryPrice(fees);
  const products = await ProductModel.find(
    { "deliveryDiscountTiers.type": "amount" },
    { name: 1, deliveryDiscountTiers: 1 },
  ).lean<Pick<ProductDoc, "_id" | "name" | "deliveryDiscountTiers">[]>();
  return products.flatMap((product) =>
    product.deliveryDiscountTiers.flatMap((tier) =>
      tier.type === "amount" && (tier.amount ?? 0) >= maxHomePrice
        ? [
            {
              productId: product._id,
              productName: product.name,
              amount: tier.amount ?? 0,
              maxHomePrice,
            },
          ]
        : [],
    ),
  );
}

export async function listDeliveryFees(): Promise<AdminDeliveryFees> {
  const deliveryFees = await loadDeliveryFees();
  return { deliveryFees, warnings: await tierWarnings(deliveryFees) };
}

const wilayaName = (code: number) => getWilaya(code)?.name ?? String(code);

async function save(
  next: DeliveryFee[],
  changed: readonly number[],
  revalidator: Revalidator,
): Promise<void> {
  await DeliveryFeeModel.bulkWrite(
    next
      .filter((fee) => changed.includes(fee.wilayaCode))
      .map(({ wilayaCode, ...fields }) => ({
        updateOne: { filter: { wilayaCode }, update: { $set: fields } },
      })),
  );
  revalidator.revalidate(["delivery-fees"]);
}

/** Prices, delay, stop desk and suspension of one wilaya. */
export async function updateDeliveryFee(
  code: number,
  update: DeliveryFeeUpdate,
  { dryRun, revalidator }: { dryRun: boolean; revalidator: Revalidator },
): Promise<AdminDeliveryFees> {
  const fees = await loadDeliveryFees();
  if (!fees.some((fee) => fee.wilayaCode === code)) throw new HttpError(404, "Wilaya introuvable.");
  const next = fees.map((fee) => (fee.wilayaCode === code ? { ...fee, ...update } : fee));
  if (!dryRun) {
    await save(next, [code], revalidator);
    logger.info("Delivery fee updated", { wilayaCode: code, ...update });
  }
  return { deliveryFees: next, warnings: await tierWarnings(next) };
}

/** Selected wilayas: every price ± amount, or suspend / reactivate. */
export async function bulkUpdateDeliveryFees(
  bulk: DeliveryBulk,
  { dryRun, revalidator }: { dryRun: boolean; revalidator: Revalidator },
): Promise<AdminDeliveryFees> {
  const fees = await loadDeliveryFees();
  const selected = new Set(bulk.codes);
  const next = fees.map((fee) => {
    if (!selected.has(fee.wilayaCode)) return fee;
    if (bulk.action === "suspend") return { ...fee, suspended: true };
    if (bulk.action === "reactivate") return { ...fee, suspended: false };
    return {
      ...fee,
      homePrice: fee.homePrice + bulk.amount,
      stopDeskPrice: fee.stopDeskPrice === null ? null : fee.stopDeskPrice + bulk.amount,
    };
  });

  if (bulk.action === "adjust") {
    const tooLow = next.find(
      (fee) =>
        selected.has(fee.wilayaCode) &&
        (fee.homePrice < 1 || (fee.stopDeskPrice !== null && fee.stopDeskPrice < 1)),
    );
    if (tooLow) {
      const lowest = Math.min(tooLow.homePrice, tooLow.stopDeskPrice ?? tooLow.homePrice);
      const message = `Avec ce changement, un prix de ${wilayaName(tooLow.wilayaCode)} passerait à ${formatPrice(lowest)} : choisissez un montant plus petit.`;
      throw new HttpError(400, message, { amount: message });
    }
  }
  if (!dryRun) {
    await save(next, bulk.codes, revalidator);
    logger.info("Delivery fees bulk update", { ...bulk, count: bulk.codes.length });
  }
  return { deliveryFees: next, warnings: await tierWarnings(next) };
}
