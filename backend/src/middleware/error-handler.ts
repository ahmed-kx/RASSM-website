import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../lib/http-error";
import { describeError, logger } from "../lib/logger";

const DATABASE_UNAVAILABLE = new Set([
  "MongoServerSelectionError",
  "MongooseServerSelectionError",
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoNotConnectedError",
]);

/** MongoDB cannot be reached (Atlas down, network or DNS problem), as opposed to a bug. */
function isDatabaseUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return DATABASE_UNAVAILABLE.has(error.name) || /buffering timed out/.test(error.message);
}

/** Unknown routes. */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json(new HttpError(404, "Ressource introuvable.").toBody());
};

/**
 * Every error ends here. Expected errors (HttpError) keep their French message; anything
 * else is logged and answered with a generic message, so internals never leak.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json(error.toBody());
    return;
  }
  const type = (error as { type?: string }).type;
  if (type === "entity.too.large") {
    res.status(413).json(new HttpError(413, "Votre demande est trop volumineuse.").toBody());
    return;
  }
  if (type === "entity.parse.failed" || type === "encoding.unsupported") {
    res.status(400).json(new HttpError(400, "Requête invalide.").toBody());
    return;
  }
  if (isDatabaseUnavailable(error)) {
    logger.error(`Database unavailable on ${req.method} ${req.originalUrl}`, describeError(error));
    res
      .status(503)
      .json(
        new HttpError(
          503,
          "Le service est momentanément indisponible. Veuillez réessayer dans un instant.",
        ).toBody(),
      );
    return;
  }
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, describeError(error));
  res
    .status(500)
    .json(
      new HttpError(500, "Une erreur est survenue. Veuillez réessayer dans un instant.").toBody(),
    );
};
