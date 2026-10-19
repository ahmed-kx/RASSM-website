"use client";

import { formatPrice } from "@rassm/shared";
import { useEffect, useRef, useState } from "react";

const STEP = 100;
/** Wait this long after the last move before writing the URL. */
const COMMIT_DELAY_MS = 250;

/**
 * Two-thumb price slider (two stacked native range inputs, so it works with the
 * keyboard and screen readers). `null` means "no limit" on that side.
 *
 * While the thumbs move, the values live in a local draft and reach the URL after a
 * short pause: URL updates are asynchronous, and a controlled input fed only from the
 * URL would snap back between fast key presses.
 */
export function PriceRange({
  idPrefix,
  bounds,
  min,
  max,
  onChange,
}: {
  idPrefix: string;
  bounds: { min: number; max: number };
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const [draft, setDraft] = useState<{ low: number; high: number } | null>(null);
  const pending = useRef<number | undefined>(undefined);

  // The URL changed from outside (e.g. "Réinitialiser"): drop the draft, unless a
  // commit of our own is still waiting.
  useEffect(() => {
    if (pending.current === undefined) setDraft(null);
  }, [min, max]);
  useEffect(() => () => window.clearTimeout(pending.current), []);

  const low = draft?.low ?? Math.max(min ?? bounds.min, bounds.min);
  const high = draft?.high ?? Math.min(max ?? bounds.max, bounds.max);
  const span = Math.max(bounds.max - bounds.min, 1);
  const percent = (value: number) => ((value - bounds.min) / span) * 100;
  const disabled = bounds.min === bounds.max;

  const update = (nextLow: number, nextHigh: number) => {
    setDraft({ low: nextLow, high: nextHigh });
    window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      pending.current = undefined;
      onChange(nextLow <= bounds.min ? null : nextLow, nextHigh >= bounds.max ? null : nextHigh);
    }, COMMIT_DELAY_MS);
  };
  const setLow = (value: number) => update(Math.min(value, high), high);
  const setHigh = (value: number) => update(low, Math.max(value, low));

  const input =
    "range-thumb absolute inset-0 h-5 w-full cursor-pointer focus-visible:outline-none disabled:cursor-not-allowed";

  return (
    <div>
      <div className="relative h-5">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink/25"
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink"
          style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }}
        />
        <label htmlFor={`${idPrefix}-price-min`} className="sr-only">
          Prix minimum
        </label>
        <input
          id={`${idPrefix}-price-min`}
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={STEP}
          value={low}
          disabled={disabled}
          aria-valuetext={formatPrice(low)}
          onChange={(event) => setLow(Number(event.target.value))}
          // When both thumbs meet at the top, keep the low one reachable.
          className={`${input} ${low > bounds.min + span / 2 ? "z-20" : "z-10"}`}
        />
        <label htmlFor={`${idPrefix}-price-max`} className="sr-only">
          Prix maximum
        </label>
        <input
          id={`${idPrefix}-price-max`}
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={STEP}
          value={high}
          disabled={disabled}
          aria-valuetext={formatPrice(high)}
          onChange={(event) => setHigh(Number(event.target.value))}
          className={`${input} z-10`}
        />
      </div>
      <p className="mt-3 flex items-center gap-3 text-xs text-ash tabular-nums">
        <span>{formatPrice(low)}</span>
        <span aria-hidden="true" className="h-px w-3 bg-ash" />
        <span>{formatPrice(high)}</span>
      </p>
    </div>
  );
}
