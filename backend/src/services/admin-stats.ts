import {
  ALGIERS_TIME_ZONE,
  ORDER_STATUSES,
  SIZES,
  algiersDate,
  bucketStart,
  bucketsOf,
  getProductStatus,
  granularityFor,
  previousRange,
  rangeInstants,
  spendPerDay,
  toAdSpendSummary,
  trendPercent,
  type AdminSettings,
  type DashboardStats,
  type Granularity,
  type OrderStatus,
  type StatsQuery,
} from "@rassm/shared";
import type { PipelineStage } from "mongoose";
import { adSpendBetween } from "../models/ad-spend";
import { OrderModel, REAL_ORDERS, type OrderDoc } from "../models/order";
import { ProductModel, toProduct, type ProductDoc } from "../models/product";
import { loadSettings } from "../models/setting";

// Tableau de bord: every figure comes from MongoDB aggregations over the orders of the
// period (by order date, Algeria time), the products and the ads spend.
//
// Bénéfice net = Σ delivered (articles − cost price × quantity − delivery discount − packaging)
//              − Σ returned (return cost + packaging) − ads spend of the period.
// Packaging and return costs are the values copied on the order when it became delivered or
// returned (the current settings for orders closed before step 3D).

const CONFIRMED_OR_LATER: OrderStatus[] = ["confirmed", "shipped", "delivered", "returned"];
const SOLD: OrderStatus[] = ["confirmed", "shipped", "delivered"];

/** Per-order amounts used by every facet. */
function orderFields(settings: AdminSettings): PipelineStage[] {
  return [
    {
      $addFields: {
        _delivered: { $eq: ["$status", "delivered"] },
        _returned: { $eq: ["$status", "returned"] },
        // Confirmed at some point: confirmed or later now, or a "confirmed" step in the history
        // (an order cancelled after the call still counts as confirmed).
        _everConfirmed: {
          $or: [
            { $in: ["$status", CONFIRMED_OR_LATER] },
            { $in: ["confirmed", { $ifNull: ["$history.status", []] }] },
          ],
        },
        _unitCost: { $ifNull: ["$item.unitCost", null] },
        _packaging: { $ifNull: ["$costs.packaging", settings.packagingCost] },
        _returnCost: { $ifNull: ["$costs.returnCost", settings.returnCost] },
      },
    },
    {
      $addFields: {
        _hasCost: { $ne: ["$_unitCost", null] },
        _profit: {
          $switch: {
            branches: [
              {
                case: "$_delivered",
                then: {
                  $subtract: [
                    "$subtotal",
                    {
                      $add: [
                        { $multiply: [{ $ifNull: ["$_unitCost", 0] }, "$item.quantity"] },
                        "$deliveryDiscount",
                        "$_packaging",
                      ],
                    },
                  ],
                },
              },
              {
                case: "$_returned",
                then: { $multiply: [-1, { $add: ["$_returnCost", "$_packaging"] }] },
              },
            ],
            default: 0,
          },
        },
      },
    },
  ];
}

const sumIf = (condition: unknown, value: unknown = 1) => ({
  $sum: { $cond: [condition, value, 0] },
});

interface Totals {
  orders: number;
  revenue: number;
  pendingRevenue: number;
  profit: number;
  delivered: number;
  returned: number;
  processed: number;
  everConfirmed: number;
  cancelledAfterConfirmation: number;
  missingCosts: number;
  returnCost: number;
  discounts: number;
  freeDelivery: number;
  clients: number;
}

const EMPTY_TOTALS: Totals = {
  orders: 0,
  revenue: 0,
  pendingRevenue: 0,
  profit: 0,
  delivered: 0,
  returned: 0,
  processed: 0,
  everConfirmed: 0,
  cancelledAfterConfirmation: 0,
  missingCosts: 0,
  returnCost: 0,
  discounts: 0,
  freeDelivery: 0,
  clients: 0,
};

const totalsGroup = {
  _id: null,
  orders: { $sum: 1 },
  revenue: sumIf("$_delivered", "$subtotal"),
  pendingRevenue: sumIf({ $in: ["$status", ["confirmed", "shipped"]] }, "$subtotal"),
  profit: { $sum: "$_profit" },
  delivered: sumIf("$_delivered"),
  returned: sumIf("$_returned"),
  processed: sumIf({ $ne: ["$status", "pending"] }),
  everConfirmed: sumIf({ $and: [{ $ne: ["$status", "pending"] }, "$_everConfirmed"] }),
  cancelledAfterConfirmation: sumIf({
    $and: [{ $eq: ["$status", "cancelled"] }, "$_everConfirmed"],
  }),
  missingCosts: sumIf({ $and: ["$_delivered", { $not: ["$_hasCost"] }] }),
  returnCost: sumIf("$_returned", { $add: ["$_returnCost", "$_packaging"] }),
  discounts: sumIf("$_delivered", "$deliveryDiscount"),
  freeDelivery: sumIf({ $and: ["$_delivered", "$freeDelivery"] }),
  phones: { $addToSet: "$phone" },
};

interface BucketRow {
  _id: Date;
  orders: number;
  revenue: number;
  profit: number;
  clients: number;
}

interface TopProductRow {
  _id: { productId: string; color: string };
  units: number;
  name: string;
  image: string;
  profit: number;
  missingCosts: number;
}

interface PeriodFacets {
  totals: (Totals & { phones?: string[] })[];
  statuses: { _id: OrderStatus; count: number }[];
  buckets: BucketRow[];
  topProducts: TopProductRow[];
  topWilayas: { _id: number; orders: number }[];
}

async function periodFacets(
  from: string,
  to: string,
  granularity: Granularity,
  settings: AdminSettings,
): Promise<PeriodFacets> {
  const { start, end } = rangeInstants(from, to);
  const [result] = await OrderModel.aggregate<PeriodFacets>([
    { $match: { createdAt: { $gte: start, $lte: end }, ...REAL_ORDERS } },
    ...orderFields(settings),
    {
      $facet: {
        totals: [
          { $group: totalsGroup },
          { $addFields: { clients: { $size: "$phones" } } },
          { $project: { phones: 0 } },
        ],
        buckets: [
          {
            $group: {
              _id: {
                $dateTrunc: {
                  date: "$createdAt",
                  unit: granularity,
                  timezone: ALGIERS_TIME_ZONE,
                  startOfWeek: "monday",
                },
              },
              orders: { $sum: 1 },
              revenue: sumIf("$_delivered", "$subtotal"),
              profit: { $sum: "$_profit" },
              phones: { $addToSet: "$phone" },
            },
          },
          { $addFields: { clients: { $size: "$phones" } } },
          { $project: { phones: 0 } },
        ],
        statuses: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        topProducts: [
          { $match: { status: { $in: SOLD } } },
          {
            $group: {
              _id: { productId: "$item.productId", color: "$item.color" },
              units: { $sum: "$item.quantity" },
              name: { $last: "$item.name" },
              image: { $last: "$item.image" },
              profit: sumIf("$_delivered", "$_profit"),
              missingCosts: sumIf({ $and: ["$_delivered", { $not: ["$_hasCost"] }] }),
            },
          },
          { $sort: { units: -1, "_id.productId": 1, "_id.color": 1 } },
          { $limit: 5 },
        ],
        topWilayas: [
          { $group: { _id: "$wilayaCode", orders: { $sum: 1 } } },
          { $sort: { orders: -1, _id: 1 } },
          { $limit: 5 },
        ],
      },
    },
  ]);
  return result ?? { totals: [], statuses: [], buckets: [], topProducts: [], topWilayas: [] };
}

/** Ads spend of each day of the period (entries spread evenly over their days). */
async function spendOf(from: string, to: string) {
  const entries = await adSpendBetween(from, to);
  const perDay = spendPerDay(entries, from, to);
  const total = [...perDay.values()].reduce((sum, value) => sum + value, 0);
  return { perDay, total };
}

const rate = (numerator: number, denominator: number) => ({
  value: denominator > 0 ? numerator / denominator : null,
  numerator,
  denominator,
});

/** Products whose total stock is at or below the threshold (status "Stock faible"). */
async function lowStockCount(threshold: number): Promise<number> {
  const docs = await ProductModel.find().lean<ProductDoc[]>();
  return docs.filter((doc) => getProductStatus(toProduct(doc), threshold) === "low").length;
}

export async function dashboardStats(query: StatsQuery): Promise<DashboardStats> {
  const { from, to } = query;
  const previous = previousRange(from, to);
  const granularity = granularityFor(from, to);
  const settings = await loadSettings();

  const [current, before, spendNow, spendBefore, latest, clientsTotal, lowStock] =
    await Promise.all([
      periodFacets(from, to, granularity, settings),
      periodFacets(previous.from, previous.to, granularity, settings),
      spendOf(from, to),
      spendOf(previous.from, previous.to),
      OrderModel.find({
        createdAt: { $gte: rangeInstants(from, to).start, $lte: rangeInstants(from, to).end },
        ...REAL_ORDERS,
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(5)
        .lean<OrderDoc[]>(),
      OrderModel.distinct("phone", REAL_ORDERS).then((phones) => phones.length),
      lowStockCount(settings.lowStockThreshold),
    ]);

  const now = current.totals[0] ?? EMPTY_TOTALS;
  const then = before.totals[0] ?? null;
  const hasPrevious = (then?.orders ?? 0) > 0;
  const spend = Math.round(spendNow.total);
  const profit = Math.round(now.profit - spendNow.total);
  const previousProfit = then ? Math.round(then.profit - spendBefore.total) : null;

  // One point per bucket (the empty ones too), with the ads spend of its days.
  const buckets = bucketsOf(from, to, granularity);
  const byBucket = new Map(current.buckets.map((row) => [algiersDate(row._id), row]));
  const spendByBucket = new Map<string, number>();
  for (const [day, amount] of spendNow.perDay) {
    const key = bucketStart(day, granularity);
    spendByBucket.set(key, (spendByBucket.get(key) ?? 0) + amount);
  }
  const series = buckets.map((start) => {
    const row = byBucket.get(start);
    return {
      start,
      orders: row?.orders ?? 0,
      revenue: row?.revenue ?? 0,
      profit: Math.round((row?.profit ?? 0) - (spendByBucket.get(start) ?? 0)),
      clients: row?.clients ?? 0,
    };
  });

  const stat = (value: number, prev: number | null, values: number[]) => {
    const previousValue = hasPrevious ? prev : null;
    return {
      value,
      previous: previousValue,
      trend: trendPercent(value, previousValue),
      series: values,
    };
  };

  // Current stock of the top products' colors.
  const productIds = [...new Set(current.topProducts.map((row) => row._id.productId))];
  const products = await ProductModel.find({ _id: { $in: productIds } }).lean<ProductDoc[]>();
  const stockOf = (productId: string, color: string) => {
    const found = products
      .find((product) => product._id === productId)
      ?.colors.find((entry) => entry.name === color);
    return found ? SIZES.reduce((sum, size) => sum + (found.stock[size] ?? 0), 0) : null;
  };

  const statuses = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const row of current.statuses) statuses[row._id] = row.count;

  return {
    range: {
      from,
      to,
      previousFrom: previous.from,
      previousTo: previous.to,
      granularity,
      hasPrevious,
    },
    kpis: {
      orders: stat(
        now.orders,
        then?.orders ?? null,
        series.map((point) => point.orders),
      ),
      revenue: stat(
        now.revenue,
        then?.revenue ?? null,
        series.map((point) => point.revenue),
      ),
      pendingRevenue: now.pendingRevenue,
      profit: stat(
        profit,
        previousProfit,
        series.map((point) => point.profit),
      ),
      margin: now.revenue > 0 ? profit / now.revenue : null,
      clients: stat(
        now.clients,
        then?.clients ?? null,
        series.map((point) => point.clients),
      ),
    },
    missingCosts: now.missingCosts,
    series: series.map(({ clients: _clients, ...point }) => point),
    statuses,
    latestOrders: latest.map((order) => ({
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      fullName: order.fullName,
      productName: order.item.name,
      image: order.item.image,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    })),
    topProducts: current.topProducts.map((row) => ({
      productId: row._id.productId,
      name: row.name,
      color: row._id.color,
      image: row.image,
      units: row.units,
      profit: row.missingCosts > 0 ? null : Math.round(row.profit),
      stock: stockOf(row._id.productId, row._id.color),
    })),
    performance: {
      confirmationRate: rate(now.everConfirmed, now.processed),
      cancelledAfterConfirmation: now.cancelledAfterConfirmation,
      deliveryRate: rate(now.delivered, now.delivered + now.returned),
      returns: { count: now.returned, cost: now.returnCost },
      discounts: { total: now.discounts, freeDeliveryOrders: now.freeDelivery },
      topWilayas: current.topWilayas.map((row) => ({ code: row._id, orders: row.orders })),
    },
    ads: toAdSpendSummary({
      spend,
      orders: now.orders,
      deliveredOrders: now.delivered,
      revenue: now.revenue,
    }),
    stock: { lowStockProducts: lowStock, threshold: settings.lowStockThreshold },
    clientsTotal,
    settings: { packagingCost: settings.packagingCost, returnCost: settings.returnCost },
  };
}

/** Spend, orders and revenue of a period, for the Publicité page. */
export async function adsSummary(from: string, to: string) {
  const { start, end } = rangeInstants(from, to);
  const [spend, [totals]] = await Promise.all([
    spendOf(from, to),
    OrderModel.aggregate<{ orders: number; delivered: number; revenue: number }>([
      { $match: { createdAt: { $gte: start, $lte: end }, ...REAL_ORDERS } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          delivered: sumIf({ $eq: ["$status", "delivered"] }),
          revenue: sumIf({ $eq: ["$status", "delivered"] }, "$subtotal"),
        },
      },
    ]),
  ]);
  return toAdSpendSummary({
    spend: Math.round(spend.total),
    orders: totals?.orders ?? 0,
    deliveredOrders: totals?.delivered ?? 0,
    revenue: totals?.revenue ?? 0,
  });
}
