import { Schema, model, type Types } from "mongoose";

/**
 * Phone numbers that caused problems (refused parcels…). Orders from these numbers are
 * still saved, but flagged "Liste noire" in the dashboard and the new order e-mail.
 */
export interface BlacklistDoc {
  _id: Types.ObjectId;
  /** Normalized like orders: "0555123456". */
  phone: string;
  /** French, e.g. "Colis refusé". */
  reason: string;
  /** Admin e-mail. */
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const blacklistSchema = new Schema<BlacklistDoc>(
  {
    phone: { type: String, required: true, unique: true },
    reason: { type: String, required: true },
    createdBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);
blacklistSchema.index({ createdAt: -1 });

export const BlacklistModel = model<BlacklistDoc>("Blacklist", blacklistSchema);

/** Blacklist entries of these phones, by phone. */
export async function findBlacklisted(
  phones: readonly string[],
): Promise<Map<string, BlacklistDoc>> {
  if (phones.length === 0) return new Map();
  const entries = await BlacklistModel.find({ phone: { $in: [...new Set(phones)] } }).lean<
    BlacklistDoc[]
  >();
  return new Map(entries.map((entry) => [entry.phone, entry]));
}
