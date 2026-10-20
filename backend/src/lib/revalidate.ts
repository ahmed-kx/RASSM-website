import { REVALIDATE_SECRET_HEADER, type CacheTag } from "@rassm/shared";
import { describeError, logger } from "./logger";

/** Tells the website to refresh its cached pages after a dashboard change. */
export interface Revalidator {
  revalidate(tags: CacheTag[]): void;
}

/**
 * Calls the website's /api/revalidate (secret in a header), in the background: a failure is
 * logged and never fails the dashboard action (the pages then refresh within their normal
 * cache time). Null config = nothing is sent.
 */
export function createRevalidator(config: { url: string; secret: string } | null): Revalidator {
  return {
    revalidate(tags) {
      if (!config) return;
      void fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", [REVALIDATE_SECRET_HEADER]: config.secret },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(5000),
      })
        .then((response) => {
          if (!response.ok)
            logger.warn("Website revalidation refused", { status: response.status, tags });
        })
        .catch((error: unknown) =>
          logger.warn("Website revalidation failed", { tags, ...describeError(error) }),
        );
    },
  };
}
