"use client";

import {
  formatPrice,
  type DashboardStats,
  type Granularity,
  type OrderStatus,
} from "@rassm/shared";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/cn";
import { formatNumber, formatRate } from "./stats-ui";

// Charts of the Tableau de bord (Recharts). One series per chart, thin marks, recessive grid,
// a tooltip on hover / tap, and a hidden table for screen readers.

type Series = DashboardStats["series"];
export type SalesMetric = "revenue" | "orders" | "profit";

export const SALES_METRICS: { id: SalesMetric; label: string }[] = [
  { id: "revenue", label: "Encaissé" },
  { id: "orders", label: "Commandes passées" },
  { id: "profit", label: "Bénéfice" },
];

const dayLabel = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const monthYearLabel = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Axis label of a bucket: "19 oct." (day and week) or "janv." (month). */
function bucketLabel(start: string, granularity: Granularity): string {
  const date = new Date(`${start}T00:00:00Z`);
  return (granularity === "month" ? monthLabel : dayLabel).format(date).replace(/\.$/, "");
}

/** Tooltip title: "19 oct.", "Semaine du 12 oct.", "octobre 2026". */
function bucketTitle(start: string, granularity: Granularity): string {
  const date = new Date(`${start}T00:00:00Z`);
  if (granularity === "month") return monthYearLabel.format(date);
  return granularity === "week" ? `Semaine du ${dayLabel.format(date)}` : dayLabel.format(date);
}

const compact = (value: number) =>
  Math.abs(value) >= 1_000_000
    ? `${formatNumber(Math.round(value / 100_000) / 10)} M`
    : Math.abs(value) >= 10_000
      ? `${formatNumber(Math.round(value / 100) / 10)} k`
      : formatNumber(value);

/**
 * Clean Y axis: always includes 0, steps of 1, 2 or 5 × 10^n (whole numbers for orders), about
 * four intervals. Nothing to show (all 0): 0 to 1 000 DA, or 0 to 4 orders.
 */
export function niceScale(
  values: number[],
  whole: boolean,
): { domain: [number, number]; ticks: number[] } {
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  if (low === 0 && high === 0) {
    const step = whole ? 1 : 250;
    return { domain: [0, step * 4], ticks: [0, 1, 2, 3, 4].map((n) => n * step) };
  }
  const rough = (high - low) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = [1, 2, 5, 10].find((m) => m * power >= rough) ?? 10;
  const step = Math.max(whole ? 1 : 0, unit * power);
  const first = Math.floor(low / step) * step;
  const last = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= last + step / 2; tick += step) ticks.push(tick);
  return { domain: [first, last], ticks };
}

const EMPTY_TEXT: Record<SalesMetric, string> = {
  revenue: "Aucune vente encaissée sur cette période",
  orders: "Aucune commande sur cette période",
  profit: "Aucun bénéfice sur cette période",
};

const formatMetric = (metric: SalesMetric, value: number) =>
  metric === "orders"
    ? `${formatNumber(value)} commande${value > 1 ? "s" : ""}`
    : formatPrice(value);

/** "Ventes": the chosen metric per day, week or month. */
export function SalesChart({
  series,
  granularity,
  metric,
}: {
  series: Series;
  granularity: Granularity;
  metric: SalesMetric;
}) {
  const data = series.map((point) => ({
    ...point,
    label: bucketLabel(point.start, granularity),
    value: point[metric],
  }));
  const hasNegative = data.some((point) => point.value < 0);
  const empty = data.every((point) => point.value === 0);
  const scale = niceScale(
    data.map((point) => point.value),
    metric === "orders",
  );
  const title = SALES_METRICS.find((entry) => entry.id === metric)?.label ?? "";

  return (
    <>
      <div className="relative h-56 sm:h-64 lg:h-72 xl:h-[22rem]" aria-hidden="true">
        {empty && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-12 pb-6">
            <p className="rounded-sm bg-paper px-3 py-1.5 text-center text-sm text-stone">
              {EMPTY_TEXT[metric]}
            </p>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-fill)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--color-chart-fill)" stopOpacity={0.25} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--color-line)" }}
              tick={{ fill: "var(--color-stone)", fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-stone)", fontSize: 12 }}
              tickFormatter={compact}
              allowDecimals={false}
              domain={scale.domain}
              ticks={scale.ticks}
              interval={0}
            />
            {hasNegative && <ReferenceLine y={0} stroke="var(--color-stone)" strokeWidth={1} />}
            <Tooltip
              cursor={{ stroke: "var(--color-stone)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const point = active ? payload?.[0]?.payload : null;
                if (!point) return null;
                return (
                  <div className="rounded-md border border-line bg-paper px-3 py-2 text-sm shadow-[0_12px_28px_-14px_rgb(17_17_17/0.45)]">
                    <p className="text-xs text-stone">{bucketTitle(point.start, granularity)}</p>
                    <p className="mt-0.5 font-semibold tabular-nums">
                      {formatMetric(metric, point.value)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-chart-series)"
              strokeWidth={2}
              fill="url(#sales-fill)"
              dot={data.length <= 31 ? { r: 2.5, fill: "var(--color-ink)", strokeWidth: 0 } : false}
              activeDot={{
                r: 5,
                fill: "var(--color-ink)",
                stroke: "var(--color-paper)",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Période</th>
            <th scope="col">{title}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.start}>
              <th scope="row">{bucketTitle(point.start, granularity)}</th>
              <td>{formatMetric(metric, point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Switch of the sales chart. */
export function MetricSwitch({
  value,
  onChange,
}: {
  value: SalesMetric;
  onChange: (metric: SalesMetric) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Afficher"
      className="flex overflow-hidden rounded-sm border border-line bg-paper"
    >
      {SALES_METRICS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="radio"
          aria-checked={value === entry.id}
          onClick={() => onChange(entry.id)}
          className={cn(
            "h-9 border-r border-line px-3 text-[13px] whitespace-nowrap last:border-r-0",
            value === entry.id ? "bg-ink text-paper" : "text-ink hover:bg-cream/60",
          )}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

/** Donut order and colors (tokens checked for colour-blind separation in this order). */
const STATUS_ORDER: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "var(--color-chart-pending)",
  confirmed: "var(--color-chart-confirmed)",
  shipped: "var(--color-chart-shipped)",
  delivered: "var(--color-chart-delivered)",
  cancelled: "var(--color-chart-cancelled)",
  returned: "var(--color-chart-returned)",
};
const STATUS_DOT: Record<OrderStatus, string> = {
  pending: "bg-chart-pending",
  confirmed: "bg-chart-confirmed",
  shipped: "bg-chart-shipped",
  delivered: "bg-chart-delivered",
  cancelled: "bg-chart-cancelled",
  returned: "bg-chart-returned",
};

/** Plural French labels of the donut ("Nouvelles", "Livrées"…). */
export const STATUS_PLURAL: Record<OrderStatus, string> = {
  pending: "Nouvelles",
  confirmed: "Confirmées",
  shipped: "Expédiées",
  delivered: "Livrées",
  cancelled: "Annulées",
  returned: "Retournées",
};

export function StatusDonut({ statuses }: { statuses: Record<OrderStatus, number> }) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + statuses[status], 0);
  const data = STATUS_ORDER.filter((status) => statuses[status] > 0).map((status) => ({
    status,
    value: statuses[status],
  }));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7 xl:flex-col xl:gap-5 2xl:flex-row">
      <div className="relative size-44 shrink-0 sm:size-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.length ? data : [{ status: "none", value: 1 }]}
              dataKey="value"
              nameKey="status"
              innerRadius="64%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="var(--color-paper)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.length ? (
                data.map((entry) => <Cell key={entry.status} fill={STATUS_COLOR[entry.status]} />)
              ) : (
                <Cell fill="var(--color-chart-grid)" />
              )}
            </Pie>
            {data.length > 0 && (
              <Tooltip
                content={({ active, payload }) => {
                  const entry = active ? payload?.[0]?.payload : null;
                  if (!entry) return null;
                  const status = entry.status as OrderStatus;
                  return (
                    <div className="rounded-md border border-line bg-paper px-3 py-2 text-sm shadow-[0_12px_28px_-14px_rgb(17_17_17/0.45)]">
                      <p className="font-semibold">{STATUS_PLURAL[status]}</p>
                      <p className="text-stone tabular-nums">
                        {formatNumber(entry.value)} · {formatRate(entry.value / total)}
                      </p>
                    </div>
                  );
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-[2.2rem] leading-none font-medium lining-nums">
              {formatNumber(total)}
            </p>
            <p className="mt-1 text-sm text-ash">Commande{total > 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {STATUS_ORDER.map((status) => (
          <li key={status} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden="true"
              className={cn("size-3 shrink-0 rounded-full", STATUS_DOT[status])}
            />
            <span className="flex-1">{STATUS_PLURAL[status]}</span>
            <span className="shrink-0 whitespace-nowrap text-stone tabular-nums">
              {total > 0 ? formatRate(statuses[status] / total) : "—"}
            </span>
            <span className="w-8 text-right font-semibold tabular-nums">
              {formatNumber(statuses[status])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
