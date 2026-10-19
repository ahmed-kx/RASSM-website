import { cn } from "@/lib/cn";

/**
 * Handwritten side quote (Covered By Your Grace), slightly rotated, with a short
 * hand-drawn line under it. Quotes are brand phrases and stay in English.
 */
export function HandQuote({
  lines,
  tilted = true,
  className,
}: {
  lines: readonly string[];
  tilted?: boolean;
  className?: string;
}) {
  return (
    <figure
      lang="en"
      className={cn(
        "font-hand text-2xl leading-[1.08] uppercase",
        tilted && "-rotate-6",
        className,
      )}
    >
      <blockquote>
        <p>
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      </blockquote>
      <svg
        viewBox="0 0 60 8"
        width={44}
        height={6}
        className="mt-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M2 6C16 4 34 3.5 58 2" />
      </svg>
    </figure>
  );
}
