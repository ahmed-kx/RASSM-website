import { deliveryFeeSchema, type DeliveryFee } from "@rassm/shared";
import { Schema, model } from "mongoose";

/** Anderson rate for one wilaya (departure Alger). `stopDeskPrice: null` = home delivery only. */
const deliveryFeeMongooseSchema = new Schema<DeliveryFee>(
  {
    wilayaCode: { type: Number, required: true, unique: true, min: 1 },
    homePrice: { type: Number, required: true, min: 0 },
    stopDeskPrice: { type: Number, default: null, min: 0 },
    estimatedDays: { type: Number, required: true, min: 1 },
  },
  { timestamps: true, versionKey: false },
);

export const DeliveryFeeModel = model<DeliveryFee>("DeliveryFee", deliveryFeeMongooseSchema);

export function toDeliveryFee(doc: DeliveryFee): DeliveryFee {
  return deliveryFeeSchema.parse({
    wilayaCode: doc.wilayaCode,
    homePrice: doc.homePrice,
    stopDeskPrice: doc.stopDeskPrice ?? null,
    estimatedDays: doc.estimatedDays,
  });
}

/** The fee table, in wilaya order. */
export async function loadDeliveryFees(): Promise<DeliveryFee[]> {
  const docs = await DeliveryFeeModel.find().sort({ wilayaCode: 1 }).lean<DeliveryFee[]>();
  return docs.map(toDeliveryFee);
}
