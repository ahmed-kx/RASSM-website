import { useCallback, useEffect, useRef } from "react";

/**
 * Bot check of the public forms: returns a function giving the milliseconds since the form
 * appeared. Sent with the form (`elapsedMs`); the API flags sends faster than 2 seconds as
 * "suspect" (kept, never refused), so real customers are never slowed down or blocked.
 */
export function useFormTimer(): () => number {
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);
  return useCallback(
    () => (shownAt.current === null ? 0 : Math.round(performance.now() - shownAt.current)),
    [],
  );
}
