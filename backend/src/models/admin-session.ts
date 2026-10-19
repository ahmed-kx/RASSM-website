import { Schema, model, type Types } from "mongoose";

/**
 * A logged-in dashboard session. The cookie holds a random token; only its SHA-256 hash
 * is stored, so a database leak does not leak usable sessions. Expired sessions are
 * removed by MongoDB (TTL index).
 */
export interface AdminSessionDoc {
  _id: Types.ObjectId;
  tokenHash: string;
  adminId: Types.ObjectId;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminSessionSchema = new Schema<AdminSessionDoc>(
  {
    tokenHash: { type: String, required: true, unique: true },
    adminId: { type: Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    expiresAt: { type: Date, required: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AdminSessionModel = model<AdminSessionDoc>("AdminSession", adminSessionSchema);
