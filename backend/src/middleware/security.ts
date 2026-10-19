import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { HttpError } from "../lib/http-error";

const INVALID_REQUEST = "Requête invalide.";

/** True when an object (any depth) has a key MongoDB could read as an operator or a path. */
function hasUnsafeKey(value: unknown, depth = 0): boolean {
  if (depth > 20) return true;
  if (Array.isArray(value)) return value.some((item) => hasUnsafeKey(item, depth + 1));
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) =>
      key.startsWith("$") ||
      key.includes(".") ||
      key === "__proto__" ||
      hasUnsafeKey(child, depth + 1),
  );
}

/**
 * NoSQL injection guard: refuses bodies with keys like "$gt" or "a.b". (Every body is also
 * validated by a Zod schema that only accepts plain strings and numbers, and Express 5
 * parses query strings without nested objects.)
 */
export function rejectUnsafeKeys(req: Request, _res: Response, next: NextFunction): void {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.params)) {
    next(new HttpError(400, INVALID_REQUEST));
    return;
  }
  next();
}

export interface RateLimitOptions {
  /** Window in milliseconds. */
  windowMs: number;
  /** Requests allowed per IP in the window. */
  limit: number;
}

/** Per-IP rate limit with a French 429 answer. */
export function limitRequests({ windowMs, limit }: RateLimitOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res
        .status(429)
        .json(
          new HttpError(
            429,
            "Trop de tentatives depuis votre connexion. Veuillez réessayer dans quelques minutes.",
          ).toBody(),
        );
    },
  });
}
