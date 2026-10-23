import {
  FORGOT_PASSWORD_MESSAGE,
  adminChangePasswordSchema,
  adminForgotPasswordSchema,
  adminLoginSchema,
  adminResetPasswordSchema,
} from "@rassm/shared";
import type { RequestHandler, Response, Router } from "express";
import { getClientInfo } from "../lib/client-info";
import { parseOrThrow } from "../lib/http-error";
import { describeError, logger } from "../lib/logger";
import {
  csrfTokenFor,
  currentAdmin,
  currentSessionId,
  deviceCookieName,
  deviceCookieOptions,
  readDeviceToken,
  readSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "../middleware/admin";
import {
  changePassword,
  listSessions,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  revokeOtherSessions,
  revokeSession,
  type AuthDeps,
} from "../services/admin-auth";

export interface AuthRouteOptions extends AuthDeps {
  /** Secure cookies (HTTPS only, `__Host-` names): true in production. */
  secureCookies: boolean;
  loginLimiter: RequestHandler;
  /** One login limit for every IP together (browsers already known are not counted). */
  loginLimiterAll: RequestHandler;
  /** A new per-IP limiter for each password route (forgot, reset, change). */
  passwordLimiter: () => RequestHandler;
}

/** The anti-CSRF cookie of the previous version: removed wherever it is still set. */
const LEGACY_CSRF_COOKIE = "rassm_csrf";

/** Removes the session cookie (logout, reset, revoked). */
function clearSessionCookies(res: Response, secure: boolean) {
  res.clearCookie(sessionCookieName(secure), sessionCookieOptions(secure));
  res.clearCookie(LEGACY_CSRF_COOKIE, { path: "/" });
}

/**
 * "Mot de passe oublié ?" requests are handled one after the other, after the answer: the
 * answer takes the same time whether the e-mail is an admin's or not, and the 3-per-hour limit
 * per account cannot be passed by sending many requests at once.
 */
let resetQueue: Promise<void> = Promise.resolve();

/** Login, logout and the password reset by e-mail: no session needed. */
export function addPublicAuthRoutes(router: Router, options: AuthRouteOptions) {
  const deps: AuthDeps = { mailer: options.mailer, adminUrl: options.adminUrl };
  const secure = options.secureCookies;

  router.post("/auth/login", options.loginLimiter, options.loginLimiterAll, async (req, res) => {
    const { email, password, remember } = parseOrThrow(adminLoginSchema, req.body);
    const session = await login(
      {
        email,
        password,
        remember: remember ?? false,
        client: getClientInfo(req),
        deviceToken: readDeviceToken(req, secure),
        previousToken: readSessionToken(req, secure),
      },
      deps,
    );
    // "Se souvenir de moi": the cookie lasts 30 days; otherwise it ends with the browser
    // (and the server ends the session after 12 hours or 2 hours without activity).
    const expires = session.remember ? session.expiresAt : undefined;
    res.cookie(sessionCookieName(secure), session.token, sessionCookieOptions(secure, expires));
    res.clearCookie(LEGACY_CSRF_COOKIE, { path: "/" });
    if (session.newDeviceToken) {
      res.cookie(deviceCookieName(secure), session.newDeviceToken, deviceCookieOptions(secure));
    }
    // The anti-CSRF token goes in the answer only: the dashboard keeps it in memory.
    res.json({ admin: session.admin, csrfToken: csrfTokenFor(session.token) });
  });

  router.post("/auth/logout", async (req, res) => {
    const token = readSessionToken(req, secure);
    if (token) await logout(token);
    clearSessionCookies(res, secure);
    res.json({ ok: true });
  });

  router.post("/auth/password/forgot", options.passwordLimiter(), async (req, res) => {
    const { email } = parseOrThrow(adminForgotPasswordSchema, req.body);
    const client = getClientInfo(req);
    resetQueue = resetQueue
      .then(() => requestPasswordReset(email, client, deps))
      .catch((error: unknown) =>
        logger.error("Password reset request crashed", describeError(error)),
      );
    res.json({ message: FORGOT_PASSWORD_MESSAGE });
  });

  router.post("/auth/password/reset", options.passwordLimiter(), async (req, res) => {
    const { token, password } = parseOrThrow(adminResetPasswordSchema, req.body);
    await resetPassword(token, password, getClientInfo(req), deps);
    clearSessionCookies(res, secure);
    res.json({ ok: true });
  });
}

/** Paramètres > Sécurité: open sessions and password change (behind requireAdmin). */
export function addSecurityRoutes(router: Router, options: AuthRouteOptions) {
  const deps: AuthDeps = { mailer: options.mailer, adminUrl: options.adminUrl };
  const secure = options.secureCookies;

  router.get("/security/sessions", async (_req, res) => {
    res.json({ sessions: await listSessions(currentAdmin(res).id, currentSessionId(res)) });
  });

  router.delete("/security/sessions/others", async (_req, res) => {
    const closed = await revokeOtherSessions(currentAdmin(res).id, currentSessionId(res));
    res.json({ closed });
  });

  router.delete("/security/sessions/:id", async (req, res) => {
    await revokeSession(currentAdmin(res).id, String(req.params.id));
    const current = req.params.id === currentSessionId(res);
    if (current) clearSessionCookies(res, secure);
    res.json({ ok: true, current });
  });

  router.post("/security/password", options.passwordLimiter(), async (req, res) => {
    const { currentPassword, newPassword } = parseOrThrow(adminChangePasswordSchema, req.body);
    const result = await changePassword(
      {
        adminId: currentAdmin(res).id,
        sessionId: currentSessionId(res),
        currentPassword,
        newPassword,
        client: getClientInfo(req),
        deviceToken: readDeviceToken(req, secure),
      },
      deps,
    );
    res.json(result);
  });
}
