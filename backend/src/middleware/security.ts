import type { NextFunction, Request, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { clientIpOf } from "../lib/client-ip";
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

export interface LimitScope {
  /**
   * "ip" (default): one counter per client IP (`clientIpOf`). "all": one counter for every
   * request, whatever its IP (a ceiling against attacks spread over many addresses).
   */
  per?: "ip" | "all";
  /** Requests that are not counted (e.g. a login from a browser the admin already used). */
  skip?: (req: Request) => boolean | Promise<boolean>;
}

/**
 * Rate limit with a French 429 answer. Counters are kept in memory: fine for one API server (with
 * several instances, move them to a shared store such as Redis, see docs/SECURITY.md).
 */
export function limitRequests({ windowMs, limit }: RateLimitOptions, scope: LimitScope = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) =>
      scope.per === "all" ? "all" : ipKeyGenerator(clientIpOf(req) ?? "unknown"),
    ...(scope.skip && { skip: scope.skip }),
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
