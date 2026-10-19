import { createHash, randomBytes } from "node:crypto";
import type { Admin } from "@rassm/shared";
import type { ClientInfo } from "../lib/client-info";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "../lib/password";
import { AdminModel, type AdminDoc } from "../models/admin";
import { AdminSessionModel, type AdminSessionDoc } from "../models/admin-session";

/** Failed logins in a row before the account is locked. */
export const MAX_FAILED_LOGINS = 5;
/** How long the account stays locked. */
export const LOCK_DURATION_MS = 15 * 60 * 1000;
/** A session lasts 14 days and is extended while it is used. */
export const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
/** Extend the expiry at most once an hour (avoids a write on every request). */
const SESSION_REFRESH_MS = 60 * 60 * 1000;

const INVALID_LOGIN = "E-mail ou mot de passe incorrect.";
const LOCKED = (until: Date, now: Date) => {
  const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return `Trop de tentatives échouées : le compte est bloqué pendant encore ${minutes} min.`;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const toAdmin = (doc: Pick<AdminDoc, "_id" | "email">): Admin => ({
  id: doc._id.toString(),
  email: doc.email,
});

/**
 * Checks the e-mail and password. After MAX_FAILED_LOGINS failures in a row the account
 * is locked for LOCK_DURATION_MS (even with the right password). Unknown e-mails get the
 * same answer and the same timing as a wrong password.
 */
export async function login(
  email: string,
  password: string,
  client: ClientInfo,
  now = new Date(),
): Promise<{ admin: Admin; token: string; expiresAt: Date }> {
  const admin = await AdminModel.findOne({ email: email.trim().toLowerCase() });
  if (!admin) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    throw new HttpError(401, INVALID_LOGIN);
  }
  if (admin.lockedUntil && admin.lockedUntil > now) {
    throw new HttpError(423, LOCKED(admin.lockedUntil, now));
  }

  if (!(await verifyPassword(password, admin.passwordHash))) {
    const attempts = admin.failedLoginAttempts + 1;
    const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
    const lock = attempts >= MAX_FAILED_LOGINS;
    await AdminModel.updateOne(
      { _id: admin._id },
      lock
        ? { $set: { failedLoginAttempts: 0, lockedUntil } }
        : { $set: { failedLoginAttempts: attempts } },
    );
    logger.warn("Admin login failed", {
      email: admin.email,
      attempts,
      locked: lock,
      ip: client.ip,
    });
    if (lock) throw new HttpError(423, LOCKED(lockedUntil, now));
    throw new HttpError(401, INVALID_LOGIN);
  }

  await AdminModel.updateOne(
    { _id: admin._id },
    { $set: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now } },
  );
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  await AdminSessionModel.create({
    tokenHash: hashToken(token),
    adminId: admin._id,
    expiresAt,
    ip: client.ip,
    userAgent: client.userAgent,
  });
  logger.info("Admin logged in", { email: admin.email, ip: client.ip });
  return { admin: toAdmin(admin), token, expiresAt };
}

/** The admin of a session token, or null (unknown, expired). Extends active sessions. */
export async function authenticate(
  token: string,
  now = new Date(),
): Promise<{ admin: Admin; expiresAt: Date } | null> {
  const session = await AdminSessionModel.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: now },
  }).lean<AdminSessionDoc>();
  if (!session) return null;
  const admin = await AdminModel.findById(session.adminId).lean<AdminDoc>();
  if (!admin) return null;

  let expiresAt = session.expiresAt;
  if (now.getTime() + SESSION_DURATION_MS - expiresAt.getTime() > SESSION_REFRESH_MS) {
    expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    await AdminSessionModel.updateOne({ _id: session._id }, { $set: { expiresAt } });
  }
  return { admin: toAdmin(admin), expiresAt };
}

export async function logout(token: string): Promise<void> {
  await AdminSessionModel.deleteOne({ tokenHash: hashToken(token) });
}
