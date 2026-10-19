import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Text input, select and textarea style: sharp, 1px border, red border when invalid. */
export const inputClasses =
  "h-12 w-full border border-ink/30 bg-paper px-4 text-[15px] text-ink placeholder:text-stone/80 transition-colors focus:border-ink focus:outline-none aria-invalid:border-error";

/** aria props linking an input to its error message (`<id>-error`). */
export function describedBy(id: string, error: string | undefined) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}

/**
 * Label + control + optional hint + French error message. `labelStyle="caps"` is the
 * small uppercase label (order form); `"plain"` is the sentence-case label with a
 * "*" for required fields (contact form, design/Contact.png).
 */
export function FormField({
  id,
  label,
  hint,
  error,
  optional,
  required,
  labelStyle = "caps",
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error: string | undefined;
  /** Adds "(facultatif)" after the label. */
  optional?: boolean;
  /** Adds " *" after a plain label. */
  required?: boolean;
  labelStyle?: "caps" | "plain";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={
          labelStyle === "caps"
            ? "text-[11px] font-semibold tracking-button uppercase"
            : "text-sm text-ink"
        }
      >
        {label}
        {required && labelStyle === "plain" && <span aria-hidden="true"> *</span>}
        {optional && (
          <span className="ml-2 font-normal tracking-normal text-ash normal-case">
            (facultatif)
          </span>
        )}
      </label>
      <div className={cn(labelStyle === "caps" ? "mt-2" : "mt-1.5")}>{children}</div>
      {hint && <div className="mt-2 text-xs leading-relaxed text-ash">{hint}</div>}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
