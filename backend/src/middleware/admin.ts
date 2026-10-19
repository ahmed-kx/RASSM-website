import { ADMIN_SESSION_COOKIE, type Admin } from "@rassm/shared";
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
    }
  }
}

export const NOT_LOGGED_IN = "Veuillez vous connecter.";

/** The session token from the Cookie header (no cookie-parser needed for one cookie). */
export function readSessionToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === ADMIN_SESSION_COOKIE) {
      const token = decodeURIComponent(value.join("="));
      return /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : null;
    }
  }
  return null;
}

/**
 * Session cookie: httpOnly (no JavaScript access), SameSite=Strict (never sent by other
 * sites), Secure in production (HTTPS only). Path "/" so the site (Next.js) sees it too:
 * the dashboard calls the API through the site's own domain.
 */
export function sessionCookieOptions(secure: boolean, expires?: Date): CookieOptions {
  return { httpOnly: true, secure, sameSite: "strict", path: "/", ...(expires && { expires }) };
}

/** 401 unless the request carries a valid session. Sets `res.locals.admin`. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = readSessionToken(req);
  const session = token ? await authenticate(token) : null;
  if (!token || !session) {
    next(new HttpError(401, NOT_LOGGED_IN));
    return;
  }
  res.locals.admin = session.admin;
  res.locals.sessionToken = token;
  next();
}

/**
 * Changes (POST, PATCH, PUT, DELETE) must come from the site: a browser always sends
 * Origin with them, so another site can never act with the admin's cookie (CSRF).
 */
export function requireSameOrigin(allowedOrigins: readonly string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const origin = req.get("origin");
    if (
      ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
      !origin ||
      allowedOrigins.includes(origin)
    ) {
      next();
      return;
    }
    next(new HttpError(403, "Requête refusée."));
  };
}

/** The admin set by requireAdmin (routes behind it only). */
export function currentAdmin(res: Response): Admin {
  const admin = res.locals.admin;
  if (!admin) throw new HttpError(401, NOT_LOGGED_IN);
  return admin;
}
