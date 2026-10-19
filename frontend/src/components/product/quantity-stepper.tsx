"use client";

import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const stepButton =
  "grid size-9 place-items-center text-ink transition-colors hover:bg-cream focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

/** − value + control, bounded by 1 and `max`. */
export function QuantityStepper({
  value,
  max,
  onChange,
  label,
  className,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  /** What the quantity is for, e.g. "Signature Hoodie, taille M". */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={`Quantité, ${label}`}
      className={cn("inline-flex items-center border border-ink/40", className)}
    >
      <button
        type="button"
        aria-label="Diminuer la quantité"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className={stepButton}
      >
        <MinusIcon />
      </button>
      <output aria-live="polite" className="w-8 text-center text-sm tabular-nums">
        {value}
      </output>
      <button
        type="button"
        aria-label="Augmenter la quantité"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={stepButton}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
