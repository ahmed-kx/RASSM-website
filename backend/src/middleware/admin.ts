import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  ADMIN_DEVICE_COOKIE,
  ADMIN_SESSION_COOKIE,
  type Admin,
} from "@rassm/shared";
import type { CookieOptions, NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error";
import { authenticate } from "../services/admin-auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express type augmentation
  namespace Express {
    interface Locals {
      /** The logged-in admin (set by requireAdmin). */
      admin?: Admin;
      /** The session token of the request (logout). */
      sessionToken?: string;
      /** The session id (Sécurité: "Cet appareil", other sessions). */
      sessionId?: string;
    }
  }
}

export const NOT_LOGGED_IN = "Veuillez vous connecter.";
const REFUSED = "Requête refusée.";
/** Expired page or token: reloading the page gives a fresh token. */
export const CSRF_REFUSED = "Requête refusée. Rechargez la page puis réessayez.";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** A random token cookie from the Cookie header (no cookie-parser needed for two cookies). */
function readTokenCookie(req: Request, cookie: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === cookie) {
      try {
        const token = decodeURIComponent(value.join("="));
        return /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export const readSessionToken = (req: Request) => readTokenCookie(req, ADMIN_SESSION_COOKIE);
export const readDeviceToken = (req: Request) => readTokenCookie(req, ADMIN_DEVICE_COOKIE);

/**
 * Session cookie: httpOnly (no JavaScript access), SameSite=Strict (never sent by other
 * sites), Secure in production (HTTPS only). Path "/" so the site (Next.js) sees it too:
 * the dashboard calls the API through the site's own domain.
 */
export function sessionCookieOptions(secure: boolean, expires?: Date): CookieOptions {
  return { httpOnly: true, secure, sameSite: "strict", path: "/", ...(expires && { expires }) };
}

/** The device cookie: same protections, kept 400 days (the longest browsers allow). */
export function deviceCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 400 * 24 * 60 * 60 * 1000,
  };
}

/**
 * The anti-CSRF token of a session: an HMAC of the session token (which only the API and the
 * httpOnly cookie know). Nothing to store, and it changes with every new session.
 */
export const csrfTokenFor = (sessionToken: string) =>
  createHmac("sha256", sessionToken).update("rassm-admin-csrf").digest("base64url");

/** The CSRF cookie: readable by the dashboard's JavaScript (it copies it into a header). */
export function csrfCookieOptions(secure: boolean, expires?: Date): CookieOptions {
  return { httpOnly: false, secure, sameSite: "strict", path: "/", ...(expires && { expires }) };
}

const sameToken = (given: string | undefined, expected: string) => {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * 401 unless the request carries a valid session. Sets `res.locals.admin`, and (re)sets the
 * CSRF cookie when the browser does not have the right one (sessions opened before it existed,
 * cookie cleared).
 */
export function requireAdmin(secureCookies: boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = readSessionToken(req);
    const session = token ? await authenticate(token) : null;
    if (!token || !session) {
      next(new HttpError(401, NOT_LOGGED_IN));
      return;
    }
    res.locals.admin = session.admin;
    res.locals.sessionToken = token;
    res.locals.sessionId = session.sessionId;
    const csrf = csrfTokenFor(token);
    if (readTokenCookie(req, ADMIN_CSRF_COOKIE) !== csrf) {
      res.cookie(
        ADMIN_CSRF_COOKIE,
        csrf,
        csrfCookieOptions(secureCookies, session.remember ? session.expiresAt : undefined),
      );
    }
    next();
  };
}

/**
 * CSRF, second lock (after SameSite=Strict cookies and the Origin check): every change made
 * with a session must carry the session's token in the X-CSRF-Token header. Another site can
 * neither read the cookie nor compute the token.
 */
export function requireCsrfToken(req: Request, res: Response, next: NextFunction) {
  const token = res.locals.sessionToken;
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  if (!token || !sameToken(req.get(ADMIN_CSRF_HEADER), csrfTokenFor(token))) {
    next(new HttpError(403, CSRF_REFUSED));
    return;
  }
  next();
}

/**
 * Changes (POST, PATCH, PUT, DELETE) must come from the site: browsers always send Origin with
 * them, so a request without it (a script) or from another site is refused (CSRF, first lock).
 * A browser that says the request comes from another site (Sec-Fetch-Site) is refused too.
 */
export function requireSameOrigin(allowedOrigins: readonly string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.get("sec-fetch-site") === "cross-site") {
      next(new HttpError(403, REFUSED));
      return;
    }
    const origin = req.get("origin");
    if (SAFE_METHODS.has(req.method) || (origin && allowedOrigins.includes(origin))) {
      next();
      return;
    }
    next(new HttpError(403, REFUSED));
  };
}

/** The session id set by requireAdmin (routes behind it only). */
export function currentSessionId(res: Response): string {
  const id = res.locals.sessionId;
  if (!id) throw new HttpError(401, NOT_LOGGED_IN);
  return id;
}

/** The admin set by requireAdmin (routes behind it only). */
export function currentAdmin(res: Response): Admin {
  const admin = res.locals.admin;
  if (!admin) throw new HttpError(401, NOT_LOGGED_IN);
  return admin;
}
