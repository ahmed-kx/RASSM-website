import { createHash, randomBytes } from "node:crypto";
import {
  INVALID_RESET_LINK,
  PASSWORD_RESET_MINUTES,
  formatLockMessage,
  type Admin,
  type AdminSessionInfo,
} from "@rassm/shared";
import { Types } from "mongoose";
import type { ClientInfo } from "../lib/client-info";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";
import { DUMMY_PASSWORD_HASH, hashPassword, needsRehash, verifyPassword } from "../lib/password";
import { deviceLabel, parseUserAgent } from "../lib/user-agent";
import { AdminModel, MAX_KNOWN_DEVICES, type AdminDoc } from "../models/admin";
import { AdminPasswordResetModel } from "../models/admin-password-reset";
import { AdminSessionModel, type AdminSessionDoc } from "../models/admin-session";
import type { SecurityContext, SecurityMailer } from "../notifications/security-email";
import { inBackground } from "./newsletter-sync";
import { accountKey, activeLock, clearThrottle, ipKey, recordFailure } from "./login-throttle";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Without "Se souvenir de moi": 12 hours at most, and 2 hours without activity. */
export const SESSION_MAX_MS = 12 * HOUR;
export const SESSION_IDLE_MS = 2 * HOUR;
/** With "Se souvenir de moi": 30 days on this device. */
export const REMEMBER_MS = 30 * 24 * HOUR;
/** The last activity is written at most once a minute (not on every request). */
const ACTIVITY_WRITE_MS = MINUTE;
/** Reset e-mails per account per hour (more requests get the same answer, nothing is sent). */
export const MAX_RESET_EMAILS_PER_HOUR = 3;

const INVALID_LOGIN = "E-mail ou mot de passe incorrect.";

export interface AuthDeps {
  mailer: SecurityMailer;
  /** Dashboard URL, for the reset link (e.g. https://rassm.dz/admin). */
  adminUrl: string;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export const toAdmin = (doc: Pick<AdminDoc, "_id" | "email">): Admin => ({
  id: doc._id.toString(),
  email: doc.email,
});

const contextOf = (client: ClientInfo, now: Date): SecurityContext => ({
  at: now,
  ip: client.ip,
  userAgent: client.userAgent,
  location: client.location,
});

const throttleKeys = (email: string, ip: string | null) =>
  ip ? [accountKey(email), ipKey(ip)] : [accountKey(email)];

const lockError = (until: Date, now: Date) =>
  new HttpError(429, formatLockMessage((until.getTime() - now.getTime()) / MINUTE));

export interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
  client: ClientInfo;
  /** The device cookie of this browser, if it has one. */
  deviceToken: string | null;
  /** The session cookie already in the browser: replaced (never reused) by the new one. */
  previousToken: string | null;
}

export interface LoginResult {
  admin: Admin;
  token: string;
  /** End of the session; the cookie only keeps it for "Se souvenir de moi". */
  expiresAt: Date;
  remember: boolean;
  /** A new device cookie to set (first login from this browser). */
  newDeviceToken: string | null;
}

/**
 * Checks the e-mail and password. Locked accounts or IPs are refused before the password is
 * checked (the lock message says nothing else). Unknown e-mails get the same answer, the same
 * timing and the same locks as a wrong password, so nobody can tell which accounts exist.
 */
export async function login(
  input: LoginInput,
  deps: AuthDeps,
  now = new Date(),
): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const { client } = input;
  const keys = throttleKeys(email, client.ip);
  const locked = await activeLock(keys, now);
  if (locked) throw lockError(locked, now);

  const admin = await AdminModel.findOne({ email });
  const valid = admin
    ? await verifyPassword(input.password, admin.passwordHash)
    : await verifyPassword(input.password, DUMMY_PASSWORD_HASH).then(() => false);

  if (!admin || !valid) {
    const failure = await recordFailure(email, client.ip, now);
    logger.warn("Admin login failed", {
      knownAccount: Boolean(admin),
      locked: Boolean(failure.lockedUntil),
      ip: client.ip,
    });
    if (admin && failure.accountLockedUntil) {
      inBackground(
        deps.mailer.sendAlert(admin.email, {
          kind: "locked",
          context: contextOf(client, now),
          lockMinutes: Math.round((failure.accountLockedUntil.getTime() - now.getTime()) / MINUTE),
        }),
        "Locked account alert",
      );
    }
    if (failure.lockedUntil) throw lockError(failure.lockedUntil, now);
    throw new HttpError(401, INVALID_LOGIN);
  }

  await clearThrottle(keys);
  // No session fixation: a session already in this browser is closed, a new token is made.
  if (input.previousToken) {
    await AdminSessionModel.deleteOne({ tokenHash: hashToken(input.previousToken) });
  }
  const token = newToken();
  const expiresAt = new Date(now.getTime() + (input.remember ? REMEMBER_MS : SESSION_MAX_MS));
  await AdminSessionModel.create({
    tokenHash: hashToken(token),
    adminId: admin._id,
    remember: input.remember,
    expiresAt,
    lastActivityAt: now,
    ip: client.ip,
    userAgent: client.userAgent,
    location: client.location,
  });

  // Known browser? Otherwise remember it and alert the admin (not for the very first login).
  const deviceHash = input.deviceToken ? hashToken(input.deviceToken) : null;
  const known = deviceHash
    ? admin.knownDevices.find((device) => device.idHash === deviceHash)
    : undefined;
  let newDeviceToken: string | null = null;
  const update: Record<string, unknown> = { lastLoginAt: now };
  if (needsRehash(admin.passwordHash)) {
    update.passwordHash = await hashPassword(input.password);
  }
  if (known) {
    known.lastSeenAt = now;
    update.knownDevices = admin.knownDevices;
  } else {
    const firstLogin = !admin.lastLoginAt && admin.knownDevices.length === 0;
    const idToken = input.deviceToken ?? newToken();
    if (!input.deviceToken) newDeviceToken = idToken;
    update.knownDevices = [
      ...admin.knownDevices,
      {
        idHash: hashToken(idToken),
        label: deviceLabel(parseUserAgent(client.userAgent)),
        firstSeenAt: now,
        lastSeenAt: now,
      },
    ]
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .slice(0, MAX_KNOWN_DEVICES);
    if (!firstLogin) {
      inBackground(
        deps.mailer.sendAlert(admin.email, { kind: "new-device", context: contextOf(client, now) }),
        "New device alert",
      );
    }
  }
  await AdminModel.updateOne({ _id: admin._id }, { $set: update });
  logger.info("Admin logged in", { email: admin.email, ip: client.ip, newDevice: !known });
  return { admin: toAdmin(admin), token, expiresAt, remember: input.remember, newDeviceToken };
}

/** When a session ends: its absolute end, or 2 hours after its last activity (12-hour ones). */
function sessionEnd(session: AdminSessionDoc): Date {
  if (session.remember) return session.expiresAt;
  const lastActivity = session.lastActivityAt ?? session.updatedAt;
  return new Date(Math.min(session.expiresAt.getTime(), lastActivity.getTime() + SESSION_IDLE_MS));
}

export interface AuthenticatedSession {
  admin: Admin;
  sessionId: string;
}

/** The admin of a session token, or null (unknown, expired, inactive too long). */
export async function authenticate(
  token: string,
  now = new Date(),
): Promise<AuthenticatedSession | null> {
  const session = await AdminSessionModel.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: now },
  }).lean<AdminSessionDoc>();
  if (!session) return null;
  if (sessionEnd(session) <= now) {
    await AdminSessionModel.deleteOne({ _id: session._id });
    return null;
  }
  const admin = await AdminModel.findById(session.adminId).lean<AdminDoc>();
  if (!admin) return null;
  const lastActivity = session.lastActivityAt ?? session.updatedAt;
  if (now.getTime() - lastActivity.getTime() >= ACTIVITY_WRITE_MS) {
    await AdminSessionModel.updateOne({ _id: session._id }, { $set: { lastActivityAt: now } });
  }
  return { admin: toAdmin(admin), sessionId: session._id.toString() };
}

export async function logout(token: string): Promise<void> {
  await AdminSessionModel.deleteOne({ tokenHash: hashToken(token) });
}

// ---------- Sessions (Paramètres > Sécurité) ----------

export async function listSessions(
  adminId: string,
  currentSessionId: string,
  now = new Date(),
): Promise<AdminSessionInfo[]> {
  const sessions = await AdminSessionModel.find({
    adminId: new Types.ObjectId(adminId),
    expiresAt: { $gt: now },
  }).lean<AdminSessionDoc[]>();
  return sessions
    .filter((session) => sessionEnd(session) > now)
    .map((session) => {
      const device = parseUserAgent(session.userAgent);
      return {
        id: session._id.toString(),
        current: session._id.toString() === currentSessionId,
        browser: device.browser,
        os: device.os,
        deviceType: device.deviceType,
        location: session.location ?? null,
        ip: session.ip,
        remember: Boolean(session.remember),
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: (session.lastActivityAt ?? session.updatedAt).toISOString(),
        expiresAt: sessionEnd(session).toISOString(),
      };
    })
    .sort((a, b) =>
      a.current === b.current
        ? b.lastActivityAt.localeCompare(a.lastActivityAt)
        : a.current
          ? -1
          : 1,
    );
}

export async function revokeSession(adminId: string, sessionId: string): Promise<void> {
  if (!Types.ObjectId.isValid(sessionId)) throw new HttpError(404, "Session introuvable.");
  const result = await AdminSessionModel.deleteOne({
    _id: new Types.ObjectId(sessionId),
    adminId: new Types.ObjectId(adminId),
  });
  if (!result.deletedCount) throw new HttpError(404, "Session introuvable.");
}

/** Every session of this admin except the current one. Returns how many were closed. */
export async function revokeOtherSessions(adminId: string, currentSessionId: string) {
  const result = await AdminSessionModel.deleteMany({
    adminId: new Types.ObjectId(adminId),
    _id: { $ne: new Types.ObjectId(currentSessionId) },
  });
  return result.deletedCount;
}

// ---------- Password ----------

/** Paramètres > Sécurité: needs the current password; the other sessions are logged out. */
export async function changePassword(
  input: {
    adminId: string;
    sessionId: string;
    currentPassword: string;
    newPassword: string;
    client: ClientInfo;
  },
  deps: AuthDeps,
  now = new Date(),
): Promise<{ closedSessions: number }> {
  const admin = await AdminModel.findById(input.adminId);
  if (!admin) throw new HttpError(401, "Veuillez vous connecter.");
  if (!(await verifyPassword(input.currentPassword, admin.passwordHash))) {
    throw new HttpError(400, "Le mot de passe actuel est incorrect.", {
      currentPassword: "Le mot de passe actuel est incorrect.",
    });
  }
  await AdminModel.updateOne(
    { _id: admin._id },
    { $set: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: now } },
  );
  const closedSessions = await revokeOtherSessions(input.adminId, input.sessionId);
  await AdminPasswordResetModel.deleteMany({ adminId: admin._id });
  logger.info("Admin password changed", { email: admin.email, closedSessions });
  inBackground(
    deps.mailer.sendAlert(admin.email, {
      kind: "password-changed",
      context: contextOf(input.client, now),
    }),
    "Password changed alert",
  );
  return { closedSessions };
}

/** "Mot de passe oublié ?": the answer is always the same; a link is sent only to an admin. */
export async function requestPasswordReset(
  email: string,
  client: ClientInfo,
  deps: AuthDeps,
  now = new Date(),
): Promise<void> {
  const admin = await AdminModel.findOne({ email: email.trim().toLowerCase() }).lean<AdminDoc>();
  if (!admin) {
    logger.info("Password reset asked for an unknown e-mail", { ip: client.ip });
    return;
  }
  const recent = await AdminPasswordResetModel.countDocuments({
    adminId: admin._id,
    createdAt: { $gt: new Date(now.getTime() - HOUR) },
  });
  if (recent >= MAX_RESET_EMAILS_PER_HOUR) {
    logger.warn("Password reset e-mails limit reached", { email: admin.email, ip: client.ip });
    return;
  }
  const token = newToken();
  const reset = await AdminPasswordResetModel.create({
    tokenHash: hashToken(token),
    adminId: admin._id,
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_MINUTES * MINUTE),
    ip: client.ip,
  });
  // Only the latest link works.
  await AdminPasswordResetModel.updateMany(
    { adminId: admin._id, _id: { $ne: reset._id }, usedAt: null },
    { $set: { usedAt: now } },
  );
  const link = `${deps.adminUrl}/nouveau-mot-de-passe#jeton=${token}`;
  inBackground(
    deps.mailer.sendPasswordReset(admin.email, link, contextOf(client, now)),
    "Password reset e-mail",
  );
}

/**
 * A reset link: works once and for 30 minutes. Sets the password, logs out every session,
 * unlocks the account (and the IP that completes the reset) and alerts the admin.
 */
export async function resetPassword(
  token: string,
  password: string,
  client: ClientInfo,
  deps: AuthDeps,
  now = new Date(),
): Promise<void> {
  const reset = await AdminPasswordResetModel.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  );
  if (!reset) throw new HttpError(400, INVALID_RESET_LINK);
  const admin = await AdminModel.findById(reset.adminId);
  if (!admin) throw new HttpError(400, INVALID_RESET_LINK);
  await AdminModel.updateOne(
    { _id: admin._id },
    { $set: { passwordHash: await hashPassword(password), passwordChangedAt: now } },
  );
  await AdminSessionModel.deleteMany({ adminId: admin._id });
  await AdminPasswordResetModel.updateMany(
    { adminId: admin._id, usedAt: null },
    { $set: { usedAt: now } },
  );
  await clearThrottle(throttleKeys(admin.email, client.ip));
  logger.info("Admin password reset", { email: admin.email, ip: client.ip });
  inBackground(
    deps.mailer.sendAlert(admin.email, { kind: "password-reset", context: contextOf(client, now) }),
    "Password reset alert",
  );
}
