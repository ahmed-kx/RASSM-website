import type { ReactNode } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { initialOf } from "@/lib/admin/format";
import { cn } from "@/lib/cn";

// Admin design system (design/admin-*.png): light content on bone, paper cards with a hairline
// border and a small radius, large serif uppercase titles, tiny spaced uppercase labels,
// black primary buttons, soft pills. Every dashboard page is built from these pieces.

// cn() only joins classes (no merging): variants never override each other, pick one per prop.
const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm transition-colors disabled:pointer-events-none disabled:opacity-50";

const buttonText = {
  /** Spaced uppercase label (main actions). */
  caps: "px-4 text-[11px] font-semibold tracking-button uppercase",
  /** Plain text ("Exporter pour Anderson", "Enregistrer"), as in the designs. */
  plain: "px-5 text-sm",
} as const;

const buttonVariants = {
  primary: "bg-ink text-paper hover:bg-graphite",
  outline: "border border-ink/80 bg-paper text-ink hover:bg-ink hover:text-paper",
  soft: "bg-cream text-ink hover:bg-sand",
  danger: "border border-error/70 bg-paper text-error hover:bg-error hover:text-paper",
  dangerSolid: "bg-error text-paper hover:bg-error/90",
  /** On a dark surface (selection bar). */
  onDarkPrimary: "bg-paper text-ink hover:bg-cream",
  onDarkOutline: "border border-paper/40 text-paper hover:bg-paper hover:text-ink",
} as const;

export function buttonClass(
  variant: keyof typeof buttonVariants,
  className?: string,
  text: keyof typeof buttonText = "caps",
): string {
  return cn(buttonBase, buttonText[text], buttonVariants[variant], className);
}

/** Input frame without height or background (textarea). */
export const adminField =
  "w-full rounded-sm border border-line px-3 text-[15px] text-ink placeholder:text-stone focus:border-ink focus:outline-none";
export const adminInput = cn(adminField, "h-11 bg-paper");

/** Tiny spaced uppercase label (card titles, table headers). */
export const adminLabel = "text-[10px] font-semibold tracking-label text-stone uppercase";

/** Large serif title, optional count ("6 produits") and small uppercase subtitle. */
export function AdminPageHeader({
  title,
  count,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  count?: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <p className={cn(adminLabel, "mb-2")}>{eyebrow}</p>}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-[2.4rem] leading-[0.95] font-medium uppercase lining-nums sm:text-[2.9rem] lg:text-[3.4rem]">
            {title}
          </h1>
          {count && <p className="text-base text-stone tabular-nums">{count}</p>}
        </div>
        {subtitle && (
          <p className="mt-2.5 text-[10px] font-semibold tracking-wide-label text-stone uppercase">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** White card with a spaced uppercase title and an optional action on the right. */
export function AdminCard({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-md border border-line bg-paper p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-3.5 flex min-h-6 items-center justify-between gap-3">
          {title && <h2 className={adminLabel}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label / value line of a card (<dl>). */
export function InfoRow({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-1.5 text-sm",
        strong && "mt-2 border-t border-line pt-3.5",
      )}
    >
      <dt className={strong ? "text-base font-semibold" : "text-ash"}>{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right wrap-break-word tabular-nums",
          strong && "text-[1.4rem] leading-none font-semibold",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** Round initial (customers and admins). */
export function InitialAvatar({
  name,
  size = "md",
  tone = "light",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  /** "light" on bone and paper, "inverse" on the dark sidebar. */
  tone?: "light" | "inverse";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-display font-semibold",
        tone === "light" ? "bg-cream text-ash" : "bg-paper text-ink",
        size === "sm" && "size-8 text-sm",
        size === "md" && "size-9 text-base",
        size === "lg" && "size-11 text-lg",
        className,
      )}
    >
      {initialOf(name)}
    </span>
  );
}

/** Empty, loading or error message inside a list. */
export function AdminEmpty({ children, tone }: { children: ReactNode; tone?: "error" }) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "rounded-md border border-dashed border-line px-4 py-12 text-center text-sm",
        tone === "error" ? "text-error" : "text-stone",
      )}
    >
      {children}
    </p>
  );
}

const PAGE_SIZES = [10, 20, 50] as const;

/** Page numbers around the current one, with "…" for the gaps. */
function pageList(current: number, last: number): (number | "gap")[] {
  const pages = new Set([1, last, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b);
  return sorted.flatMap((page, index) =>
    index > 0 && page - (sorted[index - 1] ?? page) > 1 ? ["gap" as const, page] : [page],
  );
}

/** "10 par page", "1–10 sur 69 commandes" and the page numbers. */
export function Pagination({
  page,
  pageSize,
  total,
  unit,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Plural noun: "commandes". */
  unit: string;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pageButton =
    "grid size-10 place-items-center rounded-sm border text-sm tabular-nums transition-colors";
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
    >
      <div className="flex items-center gap-4">
        <label className="relative">
          <span className="sr-only">Commandes par page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            className="h-10 appearance-none rounded-sm border border-line bg-paper pr-9 pl-3 text-sm"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} par page
              </option>
            ))}
          </select>
          <ChevronDownIcon
            width={16}
            height={16}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
          />
        </label>
        <p className="text-sm text-stone tabular-nums">
          {from}–{to} sur {total} {unit}
        </p>
      </div>
      {last > 1 && (
        <ul className="flex items-center gap-1.5">
          <li>
            <button
              type="button"
              aria-label="Page précédente"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              className={cn(pageButton, "border-line bg-paper disabled:opacity-40")}
            >
              <ChevronLeftIcon width={16} height={16} />
            </button>
          </li>
          {pageList(page, last).map((item, index) =>
            item === "gap" ? (
              <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-stone">
                …
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  aria-current={item === page ? "page" : undefined}
                  aria-label={`Page ${item}`}
                  onClick={() => onPage(item)}
                  className={cn(
                    pageButton,
                    item === page
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-paper hover:border-ink",
                  )}
                >
                  {item}
                </button>
              </li>
            ),
          )}
          <li>
            <button
              type="button"
              aria-label="Page suivante"
              disabled={page >= last}
              onClick={() => onPage(page + 1)}
              className={cn(pageButton, "border-line bg-paper disabled:opacity-40")}
            >
              <ChevronRightIcon width={16} height={16} />
            </button>
          </li>
        </ul>
      )}
    </nav>
  );
}
