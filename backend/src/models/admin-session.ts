import { Schema, model, type Types } from "mongoose";

/**
 * A logged-in dashboard session, stored server-side so it can be revoked. The cookie holds a
 * random token; only its SHA-256 hash is stored, so a database leak does not leak usable
 * sessions. Expired sessions are removed by MongoDB (TTL index on `expiresAt`).
 */
export interface AdminSessionDoc {
  _id: Types.ObjectId;
  tokenHash: string;
  adminId: Types.ObjectId;
  /** "Se souvenir de moi": 30 days; otherwise 12 hours and 2 hours of inactivity. */
  remember: boolean;
  /** The latest end of the session (absolute). */
  expiresAt: Date;
  lastActivityAt: Date;
  ip: string | null;
  userAgent: string | null;
  /** "Alger, Algérie" when the host gives it, else null. */
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminSessionSchema = new Schema<AdminSessionDoc>(
  {
    tokenHash: { type: String, required: true, unique: true },
    adminId: { type: Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    remember: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
    lastActivityAt: { type: Date, required: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    location: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AdminSessionModel = model<AdminSessionDoc>("AdminSession", adminSessionSchema);
