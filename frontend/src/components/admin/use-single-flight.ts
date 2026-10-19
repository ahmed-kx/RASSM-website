import { useRef } from "react";

/**
 * Runs one action at a time: a double click (two clicks in the same instant, before the
 * button is disabled) starts the action once.
 */
export function useSingleFlight() {
  const busy = useRef(false);
  return (run: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    void run()
      .catch(() => undefined) // errors are shown by the mutation's onError
      .finally(() => {
        busy.current = false;
      });
  };
}
