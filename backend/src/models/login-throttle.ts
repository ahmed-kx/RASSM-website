import { Schema, model } from "mongoose";

/**
 * Failed logins of one account (`account:<e-mail>`, also for e-mails that do not exist, so a
 * lock never reveals which accounts exist) or one IP (`ip:<address>`). The record disappears
 * 24 hours after its last failure or lock (TTL), which also resets the doubling of locks.
 */
export interface LoginThrottleDoc {
  _id: string;
  /** Failed logins in a row since the last lock or success. */
  failures: number;
  lockedUntil: Date | null;
  /** Locks so far: the next one lasts 15 min × 2^locks (max 24 h). */
  locks: number;
  expiresAt: Date;
}

const loginThrottleSchema = new Schema<LoginThrottleDoc>(
  {
    _id: { type: String, required: true },
    failures: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    locks: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);
loginThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LoginThrottleModel = model<LoginThrottleDoc>("LoginThrottle", loginThrottleSchema);
