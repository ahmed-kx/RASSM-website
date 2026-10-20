import { mockDeliveryFees, mockProducts } from "@rassm/shared/mocks";
import { DeliveryFeeModel } from "./models/delivery-fee";
import { ProductModel, ensureProductSkus, fromProduct } from "./models/product";

export interface SeedResult {
  productsCreated: number;
  productsReset: number;
  productsKept: number;
  deliveryFeesUpserted: number;
}

/**
 * Loads the catalog and the Anderson delivery fees from the shared mocks (already
 * validated by the shared schemas). Safe to re-run:
 * - delivery fees are upserted by wilaya (the table is reference data);
 * - products are created when missing; existing products are left untouched, so real
 *   stock and admin edits are never overwritten. `reset: true` overwrites them (stock
 *   included) with the mock values.
 */
export async function seedDatabase({ reset = false } = {}): Promise<SeedResult> {
  // Prices are edited in the dashboard: only missing wilayas are added (reset overwrites).
  const feeResult = await DeliveryFeeModel.bulkWrite(
    mockDeliveryFees.map((fee) => ({
      updateOne: {
        filter: { wilayaCode: fee.wilayaCode },
        update: reset ? { $set: fee } : { $setOnInsert: fee },
        upsert: true,
      },
    })),
  );

  const productResult = await ProductModel.bulkWrite(
    mockProducts.map((product) => {
      const { _id, ...doc } = fromProduct(product);
      return {
        updateOne: {
          filter: { _id },
          update: reset ? { $set: doc } : { $setOnInsert: doc },
          upsert: true,
        },
      };
    }),
  );
  // Indexes declared in the models (unique slug and SKU, order number…).
  await Promise.all([ProductModel.syncIndexes(), DeliveryFeeModel.syncIndexes()]);
  await ensureProductSkus();

  return {
    productsCreated: productResult.upsertedCount,
    productsReset: reset ? productResult.matchedCount : 0,
    productsKept: reset ? 0 : productResult.matchedCount,
    deliveryFeesUpserted: feeResult.upsertedCount + feeResult.modifiedCount,
  };
}
