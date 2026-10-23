import {
  AT_RISK_RETURNED_ORDERS,
  CLIENT_BADGE_LABELS,
  LOYAL_DELIVERED_ORDERS,
  adminClientSchema,
  formatWilaya,
  getWilaya,
  type AdminClient,
  type AdminClientDetail,
  type AdminClientList,
  type ClientBadge,
  type adminClientQuerySchema,
} from "@rassm/shared";
import type { PipelineStage } from "mongoose";
import type { z } from "zod";
import { buildCsv, formatPhoneForCsv } from "../lib/csv";
import { HttpError } from "../lib/http-error";
import { BlacklistModel } from "../models/blacklist";
import { OrderModel, REAL_ORDERS, type OrderDoc } from "../models/order";

// Clients of the dashboard: the orders grouped by phone number (one phone = one client),
// with a MongoDB aggregation. Name and wilaya come from the latest order.

type ClientQuery = z.output<typeof adminClientQuerySchema>;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface ClientRow {
  _id: string;
  name: string;
  wilayaCode: number;
  orders: number;
  delivered: number;
  returned: number;
  spent: number;
  firstOrderAt: Date;
  lastOrderAt: Date;
  blacklisted: boolean;
}

/** Name (part of it, any case) or phone (digits, spaces and +213 allowed). */
function searchMatch(text: string | undefined): PipelineStage.Match["$match"] | null {
  const q = text?.trim();
  if (!q) return null;
  const digits = q.replace(/[\s.+-]/g, "");
  if (/^\d{3,}$/.test(digits)) {
    return { _id: { $regex: escapeRegex(digits.replace(/^213/, "0")) } };
  }
  return { name: { $regex: escapeRegex(q), $options: "i" } };
}

/** Orders → one row per phone, with the blacklist flag. */
function groupStages(): PipelineStage[] {
  return [
    { $match: REAL_ORDERS },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: "$phone",
        name: { $first: "$fullName" },
        wilayaCode: { $first: "$wilayaCode" },
        orders: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
        returned: { $sum: { $cond: [{ $eq: ["$status", "returned"] }, 1, 0] } },
        spent: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$total", 0] } },
        firstOrderAt: { $min: "$createdAt" },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
    {
      $lookup: {
        from: BlacklistModel.collection.name,
        localField: "_id",
        foreignField: "phone",
        as: "blacklist",
      },
    },
    { $addFields: { blacklisted: { $gt: [{ $size: "$blacklist" }, 0] } } },
    { $project: { blacklist: 0 } },
  ];
}

const BADGE_MATCH: Record<ClientBadge, PipelineStage.Match["$match"]> = {
  blacklist: { blacklisted: true },
  loyal: { delivered: { $gte: LOYAL_DELIVERED_ORDERS } },
  risk: { returned: { $gte: AT_RISK_RETURNED_ORDERS } },
};

const SORTS: Record<ClientQuery["sort"], PipelineStage.Sort["$sort"]> = {
  recent: { lastOrderAt: -1, _id: 1 },
  orders: { orders: -1, lastOrderAt: -1, _id: 1 },
  spent: { spent: -1, lastOrderAt: -1, _id: 1 },
  name: { name: 1, _id: 1 },
};

function filterStages(query: Pick<ClientQuery, "q" | "wilaya" | "badge">): PipelineStage[] {
  const match = {
    ...searchMatch(query.q),
    ...(query.wilaya && { wilayaCode: query.wilaya }),
    ...(query.badge !== "all" && BADGE_MATCH[query.badge]),
  };
  return Object.keys(match).length ? [{ $match: match }] : [];
}

export function badgesOf(row: Pick<ClientRow, "blacklisted" | "delivered" | "returned">) {
  const badges: ClientBadge[] = [];
  if (row.blacklisted) badges.push("blacklist");
  if (row.delivered >= LOYAL_DELIVERED_ORDERS) badges.push("loyal");
  if (row.returned >= AT_RISK_RETURNED_ORDERS) badges.push("risk");
  return badges;
}

const toClient = (row: ClientRow): AdminClient =>
  adminClientSchema.parse({
    phone: row._id,
    name: row.name,
    wilayaCode: row.wilayaCode,
    orders: row.orders,
    delivered: row.delivered,
    returned: row.returned,
    spent: row.spent,
    firstOrderAt: row.firstOrderAt.toISOString(),
    lastOrderAt: row.lastOrderAt.toISOString(),
    badges: badgesOf(row),
  });

export async function listClients(query: ClientQuery): Promise<AdminClientList> {
  const [result] = await OrderModel.aggregate<{ rows: ClientRow[]; total: { n: number }[] }>([
    ...groupStages(),
    ...filterStages(query),
    {
      $facet: {
        rows: [
          { $sort: SORTS[query.sort] },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
        ],
        total: [{ $count: "n" }],
      },
    },
  ]).collation({ locale: "fr", strength: 1 });
  return {
    clients: (result?.rows ?? []).map(toClient),
    total: result?.total[0]?.n ?? 0,
  };
}

/** For the global search of the top bar. */
export async function searchClients(q: string, limit: number) {
  const match = searchMatch(q);
  if (!match) return [];
  const rows = await OrderModel.aggregate<ClientRow>([
    ...groupStages(),
    { $match: match },
    { $sort: { lastOrderAt: -1 } },
    { $limit: limit },
  ]);
  return rows.map((row) => ({ phone: row._id, name: row.name, orders: row.orders }));
}

export const CLIENT_CSV_COLUMNS = [
  "Nom",
  "Téléphone",
  "Wilaya",
  "Commandes",
  "Livrées",
  "Retournées",
  "Total dépensé (DA)",
  "Première commande",
  "Dernière commande",
  "Badges",
] as const;

const algiersDay = (date: Date) =>
  new Date(date.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);

/** Every client matching the filters, as a CSV for Excel. */
export async function clientsCsv(query: ClientQuery): Promise<string> {
  const rows = await OrderModel.aggregate<ClientRow>([
    ...groupStages(),
    ...filterStages(query),
    { $sort: SORTS[query.sort] },
  ]).collation({ locale: "fr", strength: 1 });
  return buildCsv(
    CLIENT_CSV_COLUMNS,
    rows.map((row) => {
      const wilaya = getWilaya(row.wilayaCode);
      return [
        row.name,
        formatPhoneForCsv(row._id),
        wilaya ? formatWilaya(wilaya) : row.wilayaCode,
        row.orders,
        row.delivered,
        row.returned,
        row.spent,
        algiersDay(row.firstOrderAt),
        algiersDay(row.lastOrderAt),
        badgesOf(row)
          .map((badge) => CLIENT_BADGE_LABELS[badge])
          .join(", "),
      ];
    }),
  );
}

/** One client (by phone): the summary, the blacklist entry and every order. */
export async function getClient(phone: string): Promise<AdminClientDetail> {
  const [rows, orders, blacklist] = await Promise.all([
    OrderModel.aggregate<ClientRow>([{ $match: { phone, ...REAL_ORDERS } }, ...groupStages()]),
    OrderModel.find({ phone, ...REAL_ORDERS })
      .sort({ createdAt: -1, _id: -1 })
      .limit(500)
      .lean<OrderDoc[]>(),
    BlacklistModel.findOne({ phone }).lean<{ reason: string; createdAt: Date }>(),
  ]);
  const row = rows[0];
  if (!row) throw new HttpError(404, "Client introuvable.");
  return {
    client: toClient(row),
    blacklist: blacklist
      ? { reason: blacklist.reason, createdAt: blacklist.createdAt.toISOString() }
      : null,
    orders: orders.map((order) => ({
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      productName: order.item.name,
      image: order.item.image,
      color: order.item.color,
      size: order.item.size,
      quantity: order.item.quantity,
      total: order.total,
      wilayaCode: order.wilayaCode,
      commune: order.commune,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}
