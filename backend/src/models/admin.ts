import { Schema, model, type Types } from "mongoose";

/** A browser this admin has logged in from (the random id of its device cookie, hashed). */
export interface KnownDeviceDoc {
  idHash: string;
  /** "Chrome 141 · Windows" */
  label: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/** A dashboard account. Created with `pnpm create-admin` (never in code). */
export interface AdminDoc {
  _id: Types.ObjectId;
  /** Lowercased, unique. */
  email: string;
  /** argon2id hash (see lib/password.ts), never the password. */
  passwordHash: string;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  /** Browsers already used to log in: a login from another one sends an alert. */
  knownDevices: KnownDeviceDoc[];
  createdAt: Date;
  updatedAt: Date;
}

/** At most this many known browsers are kept (the least recently used are dropped). */
export const MAX_KNOWN_DEVICES = 20;

const adminSchema = new Schema<AdminDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    passwordChangedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    knownDevices: {
      type: [
        new Schema<KnownDeviceDoc>(
          {
            idHash: { type: String, required: true },
            label: { type: String, default: "" },
            firstSeenAt: { type: Date, required: true },
            lastSeenAt: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, versionKey: false },
);

export const AdminModel = model<AdminDoc>("Admin", adminSchema);
