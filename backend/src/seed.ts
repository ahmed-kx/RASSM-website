import { mockDeliveryFees, mockProducts } from "@rassm/shared/mocks";
import { DeliveryFeeModel } from "./models/delivery-fee";
import { ProductModel, fromProduct } from "./models/product";

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
  const feeResult = await DeliveryFeeModel.bulkWrite(
    mockDeliveryFees.map((fee) => ({
      updateOne: { filter: { wilayaCode: fee.wilayaCode }, update: { $set: fee }, upsert: true },
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
  // Indexes declared in the models (unique slug, order number…).
  await Promise.all([ProductModel.syncIndexes(), DeliveryFeeModel.syncIndexes()]);

  return {
    productsCreated: productResult.upsertedCount,
    productsReset: reset ? productResult.matchedCount : 0,
    productsKept: reset ? 0 : productResult.matchedCount,
    deliveryFeesUpserted: feeResult.upsertedCount + feeResult.modifiedCount,
  };
}
