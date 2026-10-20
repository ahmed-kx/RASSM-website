import { FIRST_LOCK_MINUTES, MAX_FAILED_LOGINS, MAX_LOCK_MINUTES } from "@rassm/shared";
import { LoginThrottleModel, type LoginThrottleDoc } from "../models/login-throttle";

// Brute force protection of the login: MAX_FAILED_LOGINS failures in a row on one account (any
// e-mail, existing or not) or from one IP lock it for 15 minutes; each new lock doubles the
// duration (30 min, 1 h, 2 h…) up to 24 hours. A record is forgotten 24 hours after its last
// failure or lock. A successful login clears the account and the IP.

const MINUTE = 60_000;
const FORGET_AFTER_MS = 24 * 60 * MINUTE;

export const accountKey = (email: string) => `account:${email.trim().toLowerCase()}`;
export const ipKey = (ip: string) => `ip:${ip}`;

/** 15 min × 2^(locks so far), at most 24 h. */
export function lockMinutes(previousLocks: number): number {
  return Math.min(FIRST_LOCK_MINUTES * 2 ** previousLocks, MAX_LOCK_MINUTES);
}

/** The latest end among the active locks of these keys, or null. */
export async function activeLock(keys: readonly string[], now: Date): Promise<Date | null> {
  const docs = await LoginThrottleModel.find({
    _id: { $in: keys },
    lockedUntil: { $gt: now },
    expiresAt: { $gt: now },
  }).lean<LoginThrottleDoc[]>();
  const ends = docs.map((doc) => doc.lockedUntil?.getTime() ?? 0);
  return ends.length ? new Date(Math.max(...ends)) : null;
}

/** Counts one failure on a key; locks it at the 5th. Returns the new lock end, if any. */
async function failOne(key: string, now: Date): Promise<Date | null> {
  // A record past its life is a fresh start (the TTL index may not have removed it yet).
  await LoginThrottleModel.deleteOne({ _id: key, expiresAt: { $lte: now } });
  const doc = await LoginThrottleModel.findOneAndUpdate(
    { _id: key },
    { $inc: { failures: 1 }, $set: { expiresAt: new Date(now.getTime() + FORGET_AFTER_MS) } },
    { upsert: true, returnDocument: "after" },
  ).lean<LoginThrottleDoc>();
  if (!doc || doc.failures < MAX_FAILED_LOGINS) return null;
  return lockKey(key, doc.locks, now);
}

/** Locks a key now (unless already locked); the counter starts again after the lock. */
async function lockKey(key: string, previousLocks: number, now: Date): Promise<Date | null> {
  const lockedUntil = new Date(now.getTime() + lockMinutes(previousLocks) * MINUTE);
  const result = await LoginThrottleModel.updateOne(
    { _id: key, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
    {
      $set: {
        failures: 0,
        lockedUntil,
        expiresAt: new Date(lockedUntil.getTime() + FORGET_AFTER_MS),
      },
      $inc: { locks: 1 },
    },
    { upsert: false },
  );
  return result.modifiedCount ? lockedUntil : null;
}

export interface FailureResult {
  /** Set when the account got locked by this failure. */
  accountLockedUntil: Date | null;
  /** The end of the lock now applying to this login (account or IP), if any. */
  lockedUntil: Date | null;
}

/**
 * Records a failed login for the account and the IP. When the account gets locked, the IP that
 * made the attempts is locked too.
 */
export async function recordFailure(
  email: string,
  ip: string | null,
  now: Date,
): Promise<FailureResult> {
  const account = accountKey(email);
  const accountLockedUntil = await failOne(account, now);
  let ipLockedUntil: Date | null = null;
  if (ip) {
    const key = ipKey(ip);
    ipLockedUntil = await failOne(key, now);
    if (accountLockedUntil && !ipLockedUntil) {
      const doc = await LoginThrottleModel.findById(key).lean<LoginThrottleDoc>();
      ipLockedUntil = await lockKey(key, doc?.locks ?? 0, now);
    }
  }
  const ends = [accountLockedUntil, ipLockedUntil].filter((date): date is Date => date !== null);
  return {
    accountLockedUntil,
    lockedUntil: ends.length ? new Date(Math.max(...ends.map((date) => date.getTime()))) : null,
  };
}

/** A successful login or password reset: the counters, locks and doubling start over. */
export async function clearThrottle(keys: readonly string[]): Promise<void> {
  await LoginThrottleModel.deleteMany({ _id: { $in: keys } });
}
