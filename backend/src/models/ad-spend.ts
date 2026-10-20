import type { AdSpend } from "@rassm/shared";
import { Schema, model, type Types } from "mongoose";

/** Ads spend entered in the dashboard: one day or a period, spread evenly per day. */
export interface AdSpendDoc {
  _id: Types.ObjectId;
  /** Algerian calendar days, "2026-10-19" (both included). */
  startDate: string;
  endDate: string;
  /** DA, whole dinars. */
  amount: number;
  note: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const adSpendSchema = new Schema<AdSpendDoc>(
  {
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    note: { type: String, default: "" },
    createdBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);
adSpendSchema.index({ startDate: -1 });
adSpendSchema.index({ endDate: 1, startDate: 1 });

export const AdSpendModel = model<AdSpendDoc>("AdSpend", adSpendSchema);

export function toAdSpend(doc: AdSpendDoc): AdSpend {
  return {
    id: doc._id.toString(),
    startDate: doc.startDate,
    endDate: doc.endDate,
    amount: doc.amount,
    note: doc.note ?? "",
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Entries overlapping [from, to] (calendar days). */
export function adSpendBetween(from: string, to: string) {
  return AdSpendModel.find({ startDate: { $lte: to }, endDate: { $gte: from } }).lean<
    AdSpendDoc[]
  >();
}
