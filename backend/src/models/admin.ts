import { Schema, model, type Types } from "mongoose";

/** A dashboard account. Created with `pnpm create-admin` (never in code). */
export interface AdminDoc {
  _id: Types.ObjectId;
  /** Lowercased, unique. */
  email: string;
  /** scrypt hash (see lib/password.ts), never the password. */
  passwordHash: string;
  /** Failed logins in a row; reset on success or when the account gets locked. */
  failedLoginAttempts: number;
  /** Logins are refused until this date after too many failures. */
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<AdminDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const AdminModel = model<AdminDoc>("Admin", adminSchema);
