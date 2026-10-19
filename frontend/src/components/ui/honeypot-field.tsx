import { HONEYPOT_FIELD } from "@rassm/shared";
import type { Ref } from "react";

/**
 * Hidden anti-spam field ("honeypot"): off screen and skipped by keyboard and screen
 * readers, so people leave it empty while bots fill it. The API then answers as if the
 * form was sent and saves nothing. Read its value with the ref when submitting.
 */
export function HoneypotField({ id, ref }: { id: string; ref: Ref<HTMLInputElement> }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden"
    >
      <label htmlFor={id}>Laissez ce champ vide</label>
      <input
        ref={ref}
        id={id}
        name={HONEYPOT_FIELD}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}
