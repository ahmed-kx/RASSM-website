import { z } from "zod";
import { isoDateSchema } from "./common";
import { ORDER_STATUSES, orderStatusSchema } from "./order";

// Dashboard statistics (Tableau de bord, Publicité). Every number is computed by the API from
// the orders, the products and the ads spend stored in MongoDB: nothing is estimated.

/** Algeria is UTC+1 all year (no daylight saving time). */
export const ALGIERS_TIME_ZONE = "Africa/Algiers";
const ALGIERS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A calendar day in Algeria, "2026-10-19". */
export const calendarDateSchema = z.iso.date({ error: "Date invalide (AAAA-MM-JJ)." });

/** "2026-10-19" for the day it is in Algeria at this instant. */
export function algiersDate(at: Date | number = Date.now()): string {
  return new Date(new Date(at).getTime() + ALGIERS_OFFSET_MS).toISOString().slice(0, 10);
}

/** "2026-10-19" + n days. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** First and last instant of an Algerian day range (for MongoDB queries). */
export function rangeInstants(from: string, to: string): { start: Date; end: Date } {
  return {
    start: new Date(`${from}T00:00:00.000+01:00`),
    end: new Date(`${to}T23:59:59.999+01:00`),
  };
}

export const RANGE_PRESETS = ["today", "7d", "30d", "month", "year", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: "Aujourd'hui",
  "7d": "7 jours",
  "30d": "30 jours",
  month: "Ce mois",
  year: "Cette année",
  custom: "Personnalisé",
};

/** The days of a preset, ending today (Algeria time). */
export function presetRange(preset: Exclude<RangePreset, "custom">, today = algiersDate()) {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** The period of the same length just before (for the trends). */
export function previousRange(from: string, to: string) {
  const days = daysBetween(from, to);
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

export const GRANULARITIES = ["day", "week", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** Day up to a month, week up to six months, month beyond. */
export function granularityFor(from: string, to: string): Granularity {
  const days = daysBetween(from, to);
  return days <= 31 ? "day" : days <= 183 ? "week" : "month";
}

/** First day of the bucket containing `date` (weeks start on Monday). */
export function bucketStart(date: string, granularity: Granularity): string {
  if (granularity === "day") return date;
  if (granularity === "month") return `${date.slice(0, 7)}-01`;
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -weekday);
}

/** Every bucket of the range, in order (the chart shows the empty ones too). */
export function bucketsOf(from: string, to: string, granularity: Granularity): string[] {
  const buckets: string[] = [];
  let current = bucketStart(from, granularity);
  while (current <= to) {
    buckets.push(current);
    current =
      granularity === "day"
        ? addDays(current, 1)
        : granularity === "week"
          ? addDays(current, 7)
          : (() => {
              const [year, month] = current.split("-").map(Number) as [number, number];
              return month === 12
                ? `${year + 1}-01-01`
                : `${year}-${String(month + 1).padStart(2, "0")}-01`;
            })();
  }
  return buckets;
}

/** Query of the statistics: an Algerian day range, both days included (3 years at most). */
export const statsQuerySchema = z
  .object({ from: calendarDateSchema, to: calendarDateSchema })
  .refine((range) => range.from <= range.to, {
    message: "La date de début doit précéder la date de fin.",
    path: ["from"],
  })
  .refine((range) => daysBetween(range.from, range.to) <= 3 * 366, {
    message: "Choisissez une période de 3 ans au plus.",
    path: ["to"],
  });
export type StatsQuery = z.infer<typeof statsQuerySchema>;

/** Change against the previous period, in %. Null = no previous data (trend hidden). */
export function trendPercent(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

// ---------- Ads spend ----------

export const adSpendInputSchema = z
  .object({
    startDate: calendarDateSchema,
    /** Same as startDate for a single day. */
    endDate: calendarDateSchema,
    amount: z
      .number({ error: "Indiquez le montant en DA." })
      .int("Indiquez un montant entier en DA.")
      .positive("Le montant doit être supérieur à 0 DA.")
      .max(100_000_000, "Le montant ne peut pas dépasser 100 000 000 DA."),
    note: z.string().trim().max(200, "La note ne doit pas dépasser 200 caractères.").default(""),
  })
  .refine((entry) => entry.startDate <= entry.endDate, {
    message: "La date de fin doit être le même jour ou après la date de début.",
    path: ["endDate"],
  })
  .refine((entry) => daysBetween(entry.startDate, entry.endDate) <= 366, {
    message: "Une dépense couvre une année au plus.",
    path: ["endDate"],
  });
export type AdSpendInput = z.input<typeof adSpendInputSchema>;

export const adSpendSchema = z.object({
  id: z.string(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  amount: z.number().int().positive(),
  note: z.string(),
  createdAt: isoDateSchema,
});
export type AdSpend = z.infer<typeof adSpendSchema>;

/**
 * Spend of each day of [from, to]: every entry is spread evenly over its days. Returns the
 * amount per day (fractions of DA are kept until the totals are rounded).
 */
export function spendPerDay(
  entries: readonly Pick<AdSpend, "startDate" | "endDate" | "amount">[],
  from: string,
  to: string,
): Map<string, number> {
  const days = new Map<string, number>();
  for (const entry of entries) {
    const perDay = entry.amount / daysBetween(entry.startDate, entry.endDate);
    const start = entry.startDate > from ? entry.startDate : from;
    const end = entry.endDate < to ? entry.endDate : to;
    for (let day = start; day <= end; day = addDays(day, 1)) {
      days.set(day, (days.get(day) ?? 0) + perDay);
    }
  }
  return days;
}

/** Ads figures of a period. Null when the division is impossible (no spend, no orders). */
export const adsSummarySchema = z.object({
  spend: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
  deliveredOrders: z.number().int().nonnegative(),
  revenue: z.number().int().nonnegative(),
  costPerOrder: z.number().int().nonnegative().nullable(),
  costPerDeliveredOrder: z.number().int().nonnegative().nullable(),
  /** Revenue encaissé ÷ spend, e.g. 3.25. */
  roas: z.number().nonnegative().nullable(),
});
export type AdsSummary = z.infer<typeof adsSummarySchema>;

/** Cost per order, per delivered order and ROAS from the totals of a period. */
export function toAdSpendSummary(totals: {
  spend: number;
  orders: number;
  deliveredOrders: number;
  revenue: number;
}): AdsSummary {
  const { spend, orders, deliveredOrders, revenue } = totals;
  return {
    spend,
    orders,
    deliveredOrders,
    revenue,
    costPerOrder: spend > 0 && orders > 0 ? Math.round(spend / orders) : null,
    costPerDeliveredOrder:
      spend > 0 && deliveredOrders > 0 ? Math.round(spend / deliveredOrders) : null,
    roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : null,
  };
}

export const adsPageSchema = z.object({
  entries: z.array(adSpendSchema),
  summary: adsSummarySchema,
  range: z.object({ from: calendarDateSchema, to: calendarDateSchema }),
});
export type AdsPage = z.infer<typeof adsPageSchema>;

// ---------- Tableau de bord ----------

/** A KPI with its value per bucket (sparkline) and the change against the previous period. */
const statSchema = z.object({
  value: z.number(),
  previous: z.number().nullable(),
  trend: z.number().nullable(),
  series: z.array(z.number()),
});
export type Stat = z.infer<typeof statSchema>;

const rateSchema = z.object({
  /** 0 to 1. Null when nothing to divide. */
  value: z.number().min(0).max(1).nullable(),
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
});

export const dashboardStatsSchema = z.object({
  range: z.object({
    from: calendarDateSchema,
    to: calendarDateSchema,
    previousFrom: calendarDateSchema,
    previousTo: calendarDateSchema,
    granularity: z.enum(GRANULARITIES),
    /** False when the previous period had no orders: every trend is hidden. */
    hasPrevious: z.boolean(),
  }),
  kpis: z.object({
    orders: statSchema,
    /** Encaissé: product revenue of the delivered orders. */
    revenue: statSchema,
    /** Confirmed + shipped orders: still to be cashed. */
    pendingRevenue: z.number().int().nonnegative(),
    profit: statSchema,
    /** Bénéfice ÷ encaissé (0 to 1, can be negative). Null without revenue. */
    margin: z.number().nullable(),
    clients: statSchema,
  }),
  /** Delivered orders whose product had no cost price: their profit counts no product cost. */
  missingCosts: z.number().int().nonnegative(),
  series: z.array(
    z.object({
      /** First day of the bucket. */
      start: calendarDateSchema,
      orders: z.number().int().nonnegative(),
      revenue: z.number().int().nonnegative(),
      profit: z.number().int(),
    }),
  ),
  statuses: z.record(orderStatusSchema, z.number().int().nonnegative()),
  latestOrders: z.array(
    z.object({
      id: z.string(),
      orderNumber: z.string(),
      fullName: z.string(),
      productName: z.string(),
      image: z.string(),
      total: z.number().int().nonnegative(),
      status: orderStatusSchema,
      createdAt: isoDateSchema,
    }),
  ),
  topProducts: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      color: z.string(),
      image: z.string(),
      units: z.number().int().nonnegative(),
      /** Profit of the delivered units. Null when a delivered order has no cost price. */
      profit: z.number().int().nullable(),
      /** Units left in this color now. Null when the product or color no longer exists. */
      stock: z.number().int().nonnegative().nullable(),
    }),
  ),
  performance: z.object({
    /** Orders ever confirmed (status history), even if cancelled or returned since ÷ every order except pending. */
    confirmationRate: rateSchema,
    /** Orders cancelled after they had been confirmed. */
    cancelledAfterConfirmation: z.number().int().nonnegative(),
    deliveryRate: rateSchema,
    returns: z.object({
      count: z.number().int().nonnegative(),
      cost: z.number().int().nonnegative(),
    }),
    discounts: z.object({
      total: z.number().int().nonnegative(),
      freeDeliveryOrders: z.number().int().nonnegative(),
    }),
    topWilayas: z.array(
      z.object({ code: z.number().int(), orders: z.number().int().nonnegative() }),
    ),
  }),
  ads: adsSummarySchema,
  stock: z.object({
    lowStockProducts: z.number().int().nonnegative(),
    threshold: z.number().int().nonnegative(),
  }),
  /** Unique phone numbers of all orders (all time). */
  clientsTotal: z.number().int().nonnegative(),
  settings: z.object({
    packagingCost: z.number().int().nonnegative(),
    returnCost: z.number().int().nonnegative(),
  }),
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

/** Order statuses in the donut's order. */
export const DASHBOARD_STATUSES = ORDER_STATUSES;
