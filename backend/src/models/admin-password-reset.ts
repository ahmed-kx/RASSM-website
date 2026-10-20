import { Schema, model, type Types } from "mongoose";

/**
 * A password reset link. Only the SHA-256 of its random token is stored; it works once
 * (`usedAt`) and for 30 minutes (`expiresAt`). Records are kept a day (TTL on `createdAt`) to
 * count the links sent per account (rate limit).
 */
export interface AdminPasswordResetDoc {
  _id: Types.ObjectId;
  tokenHash: string;
  adminId: Types.ObjectId;
  expiresAt: Date;
  usedAt: Date | null;
  /** Who asked for it. */
  ip: string | null;
  createdAt: Date;
}

const adminPasswordResetSchema = new Schema<AdminPasswordResetDoc>(
  {
    tokenHash: { type: String, required: true, unique: true },
    adminId: { type: Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
adminPasswordResetSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const AdminPasswordResetModel = model<AdminPasswordResetDoc>(
  "AdminPasswordReset",
  adminPasswordResetSchema,
);
