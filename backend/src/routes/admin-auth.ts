import {
  ADMIN_DEVICE_COOKIE,
  ADMIN_SESSION_COOKIE,
  FORGOT_PASSWORD_MESSAGE,
  adminChangePasswordSchema,
  adminForgotPasswordSchema,
  adminLoginSchema,
  adminResetPasswordSchema,
} from "@rassm/shared";
import type { RequestHandler, Router } from "express";
import { getClientInfo } from "../lib/client-info";
import { parseOrThrow } from "../lib/http-error";
import {
  currentAdmin,
  currentSessionId,
  deviceCookieOptions,
  readDeviceToken,
  readSessionToken,
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
  /** Secure cookies (HTTPS only): true in production. */
  secureCookies: boolean;
  loginLimiter: RequestHandler;
  /** A new per-IP limiter for each password route (forgot, reset, change). */
  passwordLimiter: () => RequestHandler;
}

/** Login, logout and the password reset by e-mail: no session needed. */
export function addPublicAuthRoutes(router: Router, options: AuthRouteOptions) {
  const deps: AuthDeps = { mailer: options.mailer, adminUrl: options.adminUrl };

  router.post("/auth/login", options.loginLimiter, async (req, res) => {
    const { email, password, remember } = parseOrThrow(adminLoginSchema, req.body);
    const session = await login(
      {
        email,
        password,
        remember: remember ?? false,
        client: getClientInfo(req),
        deviceToken: readDeviceToken(req),
        previousToken: readSessionToken(req),
      },
      deps,
    );
    // "Se souvenir de moi": the cookie lasts 30 days; otherwise it ends with the browser
    // (and the server ends the session after 12 hours or 2 hours without activity).
    res.cookie(
      ADMIN_SESSION_COOKIE,
      session.token,
      sessionCookieOptions(options.secureCookies, session.remember ? session.expiresAt : undefined),
    );
    if (session.newDeviceToken) {
      res.cookie(
        ADMIN_DEVICE_COOKIE,
        session.newDeviceToken,
        deviceCookieOptions(options.secureCookies),
      );
    }
    res.json({ admin: session.admin });
  });

  router.post("/auth/logout", async (req, res) => {
    const token = readSessionToken(req);
    if (token) await logout(token);
    res.clearCookie(ADMIN_SESSION_COOKIE, sessionCookieOptions(options.secureCookies));
    res.json({ ok: true });
  });

  router.post("/auth/password/forgot", options.passwordLimiter(), async (req, res) => {
    const { email } = parseOrThrow(adminForgotPasswordSchema, req.body);
    await requestPasswordReset(email, getClientInfo(req), deps);
    res.json({ message: FORGOT_PASSWORD_MESSAGE });
  });

  router.post("/auth/password/reset", options.passwordLimiter(), async (req, res) => {
    const { token, password } = parseOrThrow(adminResetPasswordSchema, req.body);
    await resetPassword(token, password, getClientInfo(req), deps);
    res.clearCookie(ADMIN_SESSION_COOKIE, sessionCookieOptions(options.secureCookies));
    res.json({ ok: true });
  });
}

/** Paramètres > Sécurité: open sessions and password change (behind requireAdmin). */
export function addSecurityRoutes(router: Router, options: AuthRouteOptions) {
  const deps: AuthDeps = { mailer: options.mailer, adminUrl: options.adminUrl };

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
    if (current) res.clearCookie(ADMIN_SESSION_COOKIE, sessionCookieOptions(options.secureCookies));
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
      },
      deps,
    );
    res.json(result);
  });
}
