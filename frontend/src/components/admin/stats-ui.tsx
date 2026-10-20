"use client";

import {
  RANGE_PRESETS,
  RANGE_PRESET_LABELS,
  algiersDate,
  formatPrice,
  presetRange,
  type RangePreset,
  type Stat,
  type StatsQuery,
} from "@rassm/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { CalendarIcon, ChevronDownIcon, InfoIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { AdminMenu } from "./admin-top-bar";
import { adminInput, adminLabel, buttonClass } from "./admin-ui";

// Statistics pieces (Tableau de bord, Publicité): the "ⓘ" explanation, the period picker
// (kept in the URL), KPI cards with a bar sparkline, and French number formats.

const number = new Intl.NumberFormat("fr-FR");
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** French digits with a narrow no-break space ("1 280"). */
export const formatNumber = (value: number) => number.format(value).replace(/\s/g, " ");
/** 0.756 → "75,6 %" */
export const formatRate = (value: number | null) =>
  value === null ? "—" : percent.format(value).replace(/\s/g, " ");
/** 3.25 → "3,25" */
export const formatRatio = (value: number | null) =>
  value === null ? "—" : decimal.format(value).replace(/\s/g, " ");
/** A DA amount or "—" when it cannot be computed. */
export const formatAmount = (value: number | null) => (value === null ? "—" : formatPrice(value));

/** Small "ⓘ" button: explains in French how a number is calculated. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <AdminMenu
      label={`Calcul : ${label}`}
      placement="anchored"
      triggerClassName="-m-2 grid size-8 shrink-0 place-items-center rounded-full text-stone hover:text-ink"
      trigger={<InfoIcon width={15} height={15} />}
    >
      {() => (
        <div className="px-4 py-3 text-[13px] leading-relaxed text-ash">
          <p className="mb-1 font-semibold text-ink">{label}</p>
          {children}
        </div>
      )}
    </AdminMenu>
  );
}

/** Spaced uppercase label with its "ⓘ". */
export function StatLabel({ label, info }: { label: string; info: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <h2 className={cn(adminLabel, "text-ash")}>{label}</h2>
      <InfoTip label={label}>{info}</InfoTip>
    </div>
  );
}

// ---------- Period ----------

export interface StatsRange extends StatsQuery {
  preset: RangePreset;
}

/** The period of the page, from the URL (?periode=7d, or ?du=…&au=… for a custom one). */
export function useStatsRange(defaultPreset: Exclude<RangePreset, "custom"> = "30d") {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = algiersDate();
  const from = params.get("du");
  const to = params.get("au");
  const asked = RANGE_PRESETS.find((preset) => preset === params.get("periode"));
  const valid = (value: string | null): value is string =>
    value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);

  let range: StatsRange;
  if (valid(from) && valid(to) && from <= to) {
    range = { preset: "custom", from, to };
  } else {
    const preset = asked && asked !== "custom" ? asked : defaultPreset;
    range = { preset, ...presetRange(preset, today) };
  }

  const set = (next: URLSearchParams) => {
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return {
    range,
    today,
    setPreset: (preset: Exclude<RangePreset, "custom">) =>
      set(new URLSearchParams(preset === defaultPreset ? {} : { periode: preset })),
    setCustom: (customFrom: string, customTo: string) =>
      set(new URLSearchParams({ du: customFrom, au: customTo })),
  };
}

const longDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
/** "19 oct. 2026" */
export const formatDay = (date: string) => longDate.format(new Date(`${date}T00:00:00Z`));

/** Presets (Aujourd'hui, 7 jours… Personnalisé) in a dropdown with two date fields. */
export function RangePicker({
  range,
  today,
  onPreset,
  onCustom,
}: {
  range: StatsRange;
  today: string;
  onPreset: (preset: Exclude<RangePreset, "custom">) => void;
  onCustom: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const invalid = !from || !to || from > to;
  return (
    <AdminMenu
      label="Choisir la période"
      placement="anchored"
      onOpen={() => {
        setFrom(range.from);
        setTo(range.to);
      }}
      triggerClassName="flex h-12 items-center gap-3 rounded-sm border border-ink/80 bg-paper px-4 text-sm tabular-nums hover:bg-cream/60"
      trigger={
        <>
          <CalendarIcon width={18} height={18} />
          <span>
            {range.from === range.to
              ? formatDay(range.from)
              : `${formatDay(range.from)} — ${formatDay(range.to)}`}
          </span>
          <ChevronDownIcon width={16} height={16} />
        </>
      }
    >
      {(close) => (
        <div className="py-1">
          <ul>
            {RANGE_PRESETS.filter((preset) => preset !== "custom").map((preset) => (
              <li key={preset}>
                <button
                  type="button"
                  aria-current={range.preset === preset ? "true" : undefined}
                  onClick={() => {
                    onPreset(preset as Exclude<RangePreset, "custom">);
                    close();
                  }}
                  className="flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-cream/60 aria-[current=true]:font-semibold"
                >
                  {RANGE_PRESET_LABELS[preset]}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="border-t border-line px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (invalid) return;
              onCustom(from, to);
              close();
            }}
          >
            <p className={cn(adminLabel, "mb-2")}>{RANGE_PRESET_LABELS.custom}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-stone">
                Du
                <input
                  type="date"
                  value={from}
                  max={to || today}
                  onChange={(event) => setFrom(event.target.value)}
                  className={cn(adminInput, "mt-1 px-2 text-sm")}
                />
              </label>
              <label className="block text-xs text-stone">
                Au
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(event) => setTo(event.target.value)}
                  className={cn(adminInput, "mt-1 px-2 text-sm")}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={invalid}
              className={buttonClass("primary", "mt-3 w-full")}
            >
              Appliquer
            </button>
          </form>
        </div>
      )}
    </AdminMenu>
  );
}

/** "par rapport au 20 sept. — 19 oct." */
export function previousLabel(previousFrom: string, previousTo: string) {
  return previousFrom === previousTo
    ? `par rapport au ${formatDay(previousFrom)}`
    : `par rapport à la période du ${formatDay(previousFrom)} au ${formatDay(previousTo)}`;
}

// ---------- KPI cards ----------

/** Thin bars of the value per day / week / month (real data only, last bar darker). */
export function BarSparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const width = 100 / values.length;
  const zero = (max / span) * 40;
  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-12 w-24 shrink-0 sm:w-28 xl:w-16 2xl:w-24"
    >
      {values.map((value, index) => {
        const height = Math.max((Math.abs(value) / span) * 40, value === 0 ? 0 : 1.5);
        const y = value >= 0 ? zero - height : zero;
        return (
          <rect
            key={index}
            x={index * width + width * 0.18}
            y={y}
            width={width * 0.64}
            height={height}
            rx={Math.min(1.2, width * 0.3)}
            className={index === values.length - 1 ? "fill-ash" : "fill-chart-fill"}
          />
        );
      })}
    </svg>
  );
}

/** "↗ 12 %" (green up, red down) or nothing when the trend is hidden. */
export function Trend({ value, title }: { value: number | null; title?: string }) {
  if (value === null) return null;
  const up = value > 0;
  const flat = value === 0;
  return (
    <p
      title={title}
      className={cn(
        "flex items-center gap-1 text-[13px] tabular-nums",
        flat ? "text-stone" : up ? "text-success" : "text-error",
      )}
    >
      <span aria-hidden="true">{flat ? "→" : up ? "↗" : "↘"}</span>
      <span className="sr-only">{flat ? "Stable" : up ? "Hausse de" : "Baisse de"}</span>
      {up ? "+" : ""}
      {decimal.format(value).replace(/\s/g, " ")} %
    </p>
  );
}

/** Dashboard KPI card (design/admin-dashboard.png): label + ⓘ, value, trend, bar sparkline. */
export function StatCard({
  label,
  info,
  value,
  stat,
  previousTitle,
  children,
}: {
  label: string;
  info: ReactNode;
  value: string;
  stat?: Stat;
  previousTitle?: string;
  /** Under the value (e.g. "en attente : 3 200 DA"). */
  children?: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-md border border-line bg-paper p-4 sm:p-5">
      <StatLabel label={label} info={info} />
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[2.1rem] leading-none font-medium whitespace-nowrap lining-nums sm:text-[2.3rem] xl:text-[1.85rem] 2xl:text-[2.3rem]">
            {value}
          </p>
          {children}
          <div className="mt-2 min-h-5">
            <Trend value={stat?.trend ?? null} title={previousTitle} />
          </div>
        </div>
        {stat && <BarSparkline values={stat.series} />}
      </div>
    </section>
  );
}

/** Smaller figure (Performance, Publicité rows). */
export function MetricTile({
  label,
  info,
  value,
  detail,
  tone,
}: {
  label: string;
  info: ReactNode;
  value: string;
  detail?: ReactNode;
  tone?: "error";
}) {
  return (
    <section className="min-w-0 rounded-md border border-line bg-paper p-4 sm:p-5">
      <StatLabel label={label} info={info} />
      <p
        className={cn(
          "mt-2 font-display text-[1.85rem] leading-none font-medium whitespace-nowrap lining-nums",
          tone === "error" && "text-error",
        )}
      >
        {value}
      </p>
      {detail && <div className="mt-1.5 text-[13px] text-stone">{detail}</div>}
    </section>
  );
}

/** Bottom link card: icon, label, figure, arrow. */
export function LinkCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-md border border-line bg-bone">
        <Icon width={24} height={24} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn(adminLabel, "text-ash")}>{label}</p>
        <p className="mt-1 font-display text-[1.9rem] leading-none font-medium lining-nums">
          {value}
        </p>
        <p className="mt-1 text-[13px] text-stone">{detail}</p>
      </div>
    </div>
  );
}
