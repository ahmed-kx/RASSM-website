import {
  DELIVERY_TYPE_LABELS,
  EDITABLE_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_TABS,
  adminOrderSchema,
  canChangeStatus,
  formatPrice,
  formatWilaya,
  getWilaya,
  orderSummarySchema,
  type Admin,
  type AdminOrder,
  type AdminOrderEdit,
  type AdminOrderList,
  type AdminOrderUpdates,
  type OrderStatus,
  type OrderTab,
  type Product,
  type adminOrderQuerySchema,
} from "@rassm/shared";
import { Types, type QueryFilter } from "mongoose";
import type { z } from "zod";
import { HttpError } from "../lib/http-error";
import { describeError, logger } from "../lib/logger";
import type { MetaEvents } from "../meta/conversions-api";
import { BlacklistModel, findBlacklisted, type BlacklistDoc } from "../models/blacklist";
import { OrderModel, toOrderSummary, type OrderDoc, type OrderHistoryDoc } from "../models/order";
import { priceOrder } from "./pricing";
import { loadProduct, releaseStock, reserveStock, stockError, type Variant } from "./stock";

const ORDER_NOT_FOUND = "Commande introuvable.";
const CONFLICT = "La commande vient d'être modifiée ailleurs : rechargez la page.";

/** Algeria is UTC+1 all year (no daylight saving time). */
const ALGIERS_OFFSET = "+01:00";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function toAdminOrder(doc: OrderDoc, blacklist: Map<string, BlacklistDoc>): AdminOrder {
  const entry = blacklist.get(doc.phone);
  return adminOrderSchema.parse({
    ...toOrderSummary(doc),
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
    ip: doc.client?.ip ?? null,
    userAgent: doc.client?.userAgent ?? null,
    suspicious: doc.suspicious ?? false,
    suspiciousReason: doc.suspiciousReason ?? null,
    blacklist: entry ? { reason: entry.reason, createdAt: entry.createdAt.toISOString() } : null,
    openedAt: doc.openedAt?.toISOString() ?? null,
    adminNote: doc.adminNote ?? "",
    history: (doc.history ?? []).map((line) => ({
      at: line.at.toISOString(),
      by: line.by ?? null,
      type: line.type,
      ...(line.status && { status: line.status }),
      message: line.message,
    })),
    stockReserved: doc.stockReserved ?? true,
    metaPurchaseStatus: doc.metaPurchase?.status ?? "pending",
    updatedAt: doc.updatedAt.toISOString(),
  });
}

async function toAdminOrders(docs: OrderDoc[]): Promise<AdminOrder[]> {
  const blacklist = await findBlacklisted(docs.map((doc) => doc.phone));
  return docs.map((doc) => toAdminOrder(doc, blacklist));
}

async function toAdminOrderOne(doc: OrderDoc): Promise<AdminOrder> {
  const [order] = await toAdminOrders([doc]);
  if (!order) throw new Error("Order conversion failed.");
  return order;
}

function parseId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, ORDER_NOT_FOUND);
  return new Types.ObjectId(id);
}

async function loadOrder(id: string): Promise<OrderDoc> {
  const doc = await OrderModel.findById(parseId(id)).lean<OrderDoc>();
  if (!doc) throw new HttpError(404, ORDER_NOT_FOUND);
  // Orders saved before the dashboard have no flag: they all still hold their units.
  return { ...doc, stockReserved: doc.stockReserved ?? true };
}

const historyLine = (
  admin: Admin | null,
  type: OrderHistoryDoc["type"],
  message: string,
  status?: OrderStatus,
): OrderHistoryDoc => ({
  at: new Date(),
  by: admin?.email ?? null,
  type,
  message,
  ...(status && { status }),
});

const articles = (count: number) => `${count} article${count > 1 ? "s" : ""}`;

// ---------- List, polling, detail ----------

type OrderQuery = z.output<typeof adminOrderQuerySchema>;

function encodeCursor(doc: Pick<OrderDoc, "_id" | "createdAt">): string {
  return Buffer.from(`${doc.createdAt.toISOString()}|${doc._id.toString()}`).toString("base64url");
}

function decodeCursor(cursor: string): QueryFilter<OrderDoc> | null {
  const [date, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const createdAt = new Date(date ?? "");
  if (!id || !Types.ObjectId.isValid(id) || Number.isNaN(createdAt.getTime())) return null;
  return {
    $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: new Types.ObjectId(id) } }],
  };
}

/** Matches "RSM-000123" for "RSM-000123", "rsm123" or "123". */
const orderNumberPattern = (digits: string) => `^RSM-0*${digits.replace(/^0+(?=\d)/, "")}$`;

/**
 * Text search of the orders: a name (part of it, any case), a phone (part of it, spaces and
 * +213 allowed) or an internal order number ("RSM-000123", "rsm-123", "123").
 */
export function orderSearchFilter(text: string): QueryFilter<OrderDoc> {
  const q = text.trim();
  const compact = q.replace(/[\s.-]/g, "");
  const number = /^rsm(\d+)$/i.exec(compact);
  if (number?.[1]) return { orderNumber: { $regex: orderNumberPattern(number[1]) } };
  if (/^\+?\d+$/.test(compact)) {
    const digits = compact.replace(/^\+/, "");
    return {
      $or: [
        { orderNumber: { $regex: orderNumberPattern(digits) } },
        ...(digits.length >= 3
          ? [{ phone: { $regex: escapeRegex(digits.replace(/^213/, "0")) } }]
          : []),
      ],
    };
  }
  return { fullName: { $regex: escapeRegex(q), $options: "i" } };
}

/** Search, wilaya and dates: the filters shared by the list and its tab counts. */
function baseFilter(query: OrderQuery): QueryFilter<OrderDoc> {
  const q = query.q?.trim();
  const filter: QueryFilter<OrderDoc> = q ? orderSearchFilter(q) : {};
  if (query.wilaya) filter.wilayaCode = query.wilaya;
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from && { $gte: new Date(`${query.from}T00:00:00.000${ALGIERS_OFFSET}`) }),
      ...(query.to && { $lte: new Date(`${query.to}T23:59:59.999${ALGIERS_OFFSET}`) }),
    };
  }
  return filter;
}

export async function listOrders(query: OrderQuery): Promise<AdminOrderList> {
  const base = baseFilter(query);
  const filter: QueryFilter<OrderDoc> = {
    ...base,
    ...(query.status !== "all" && { status: query.status }),
  };
  // Numbered pages (dashboard table) or a cursor ("load more").
  const cursorFilter = !query.page && query.cursor ? decodeCursor(query.cursor) : null;
  const [docs, grouped] = await Promise.all([
    OrderModel.find(cursorFilter ? { $and: [filter, cursorFilter] } : filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(query.page ? (query.page - 1) * query.limit : 0)
      .limit(query.limit + 1)
      .lean<OrderDoc[]>(),
    OrderModel.aggregate<{ _id: OrderStatus; count: number }>([
      { $match: base },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  const counts = Object.fromEntries(ORDER_TABS.map((tab) => [tab, 0])) as Record<OrderTab, number>;
  for (const { _id, count } of grouped) {
    counts[_id] = count;
    counts.all += count;
  }
  const page = docs.slice(0, query.limit);
  const last = page.at(-1);
  return {
    orders: await toAdminOrders(page),
    nextCursor: docs.length > query.limit && last ? encodeCursor(last) : null,
    counts,
  };
}

/** For the live dashboard: orders created after `since`, and the "Nouveau" count. */
export async function orderUpdates(
  since: Date | null,
  now = new Date(),
): Promise<AdminOrderUpdates> {
  const [docs, unopened] = await Promise.all([
    since
      ? OrderModel.find({ createdAt: { $gt: since } })
          .sort({ createdAt: 1 })
          .limit(20)
          .lean<OrderDoc[]>()
      : Promise.resolve([]),
    OrderModel.countDocuments({ status: "pending", openedAt: null }),
  ]);
  return { orders: await toAdminOrders(docs), unopened, serverTime: now.toISOString() };
}

/** One order (marked as opened), with its product as it is now (stock for edits). */
export async function getOrder(
  id: string,
): Promise<{ order: AdminOrder; product: Product | null }> {
  const doc = await OrderModel.findOneAndUpdate(
    { _id: parseId(id), openedAt: null },
    { $set: { openedAt: new Date() } },
    { returnDocument: "after", timestamps: false },
  ).lean<OrderDoc>();
  const order = doc ?? (await loadOrder(id));
  const product = await loadProduct(order.item.productId, { includeInactive: true });
  return { order: await toAdminOrderOne(order), product };
}

// ---------- Status ----------

const variantOf = (doc: Pick<OrderDoc, "item">): Variant => ({
  productId: doc.item.productId,
  color: doc.item.color,
  size: doc.item.size,
  quantity: doc.item.quantity,
});

/**
 * Changes the status if the transition is allowed. Cancelled / returned give the units
 * back exactly once (the stockReserved flag flips atomically first); reopening a cancelled
 * order takes them again if they are still in stock. Confirming sends the Meta event.
 */
export async function changeStatus(
  id: string,
  to: OrderStatus,
  admin: Admin,
  metaEvents: MetaEvents,
): Promise<AdminOrder> {
  const doc = await loadOrder(id);
  const from = doc.status;
  if (!canChangeStatus(from, to)) {
    throw new HttpError(
      409,
      `Impossible de passer de « ${ORDER_STATUS_LABELS[from]} » à « ${ORDER_STATUS_LABELS[to]} ».`,
    );
  }
  const releases = (to === "cancelled" || to === "returned") && doc.stockReserved;
  const takesAgain = to === "pending" && !doc.stockReserved;
  const message = `Statut : ${ORDER_STATUS_LABELS[from]} → ${ORDER_STATUS_LABELS[to]}.${
    releases ? ` Stock remis (${articles(doc.item.quantity)}).` : ""
  }${takesAgain ? ` Stock repris (${articles(doc.item.quantity)}).` : ""}`;

  if (takesAgain && !(await reserveStock(variantOf(doc), { includeInactive: true }))) {
    const error = await stockError(variantOf(doc), { includeInactive: true });
    throw new HttpError(
      409,
      `Impossible de réactiver la commande : ${error.message}`,
      error.fields,
    );
  }

  const updated = await OrderModel.findOneAndUpdate(
    { _id: doc._id, status: from, ...(takesAgain && { stockReserved: false }) },
    {
      $set: { status: to, ...(takesAgain && { stockReserved: true }) },
      $push: { history: historyLine(admin, "status", message, to) },
    },
    { returnDocument: "after" },
  ).lean<OrderDoc>();
  if (!updated) {
    if (takesAgain) await releaseStock(variantOf(doc));
    throw new HttpError(409, CONFLICT);
  }

  let result = updated;
  if (to === "cancelled" || to === "returned") {
    // Only the request that flips the flag gives the units back.
    const flipped = await OrderModel.findOneAndUpdate(
      { _id: doc._id, stockReserved: { $ne: false } },
      { $set: { stockReserved: false } },
      { returnDocument: "after" },
    ).lean<OrderDoc>();
    if (flipped) {
      await releaseStock(variantOf(doc));
      result = flipped;
    }
  }

  if (to === "confirmed") {
    void metaEvents
      .sendOrderConfirmed(result)
      .catch((error: unknown) =>
        logger.error("Meta confirmed event crashed", describeError(error)),
      );
  }
  logger.info("Order status changed", { orderNumber: doc.orderNumber, from, to, by: admin.email });
  return toAdminOrderOne(result);
}

/** Marks confirmed orders as shipped (after the Anderson export). */
export async function shipOrders(ids: readonly string[], admin: Admin, metaEvents: MetaEvents) {
  let shipped = 0;
  for (const id of ids) {
    try {
      await changeStatus(id, "shipped", admin, metaEvents);
      shipped += 1;
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
    }
  }
  return { shipped, skipped: ids.length - shipped };
}

// ---------- Edit ----------

function wilayaLabel(code: number) {
  const wilaya = getWilaya(code);
  return wilaya ? formatWilaya(wilaya) : String(code);
}

/** French list of what changed, e.g. "Taille M → L, Quantité 1 → 2". */
function describeChanges(doc: OrderDoc, edit: AdminOrderEdit, newTotal: number): string[] {
  const changes: string[] = [];
  const diff = (label: string, before: string, after: string) => {
    if (before !== after) changes.push(`${label} ${before} → ${after}`);
  };
  diff("Couleur", doc.item.color, edit.color);
  diff("Taille", doc.item.size, edit.size);
  diff("Quantité", String(doc.item.quantity), String(edit.quantity));
  diff("Nom", doc.fullName, edit.fullName);
  diff("Téléphone", doc.phone, edit.phone);
  diff("Wilaya", wilayaLabel(doc.wilayaCode), wilayaLabel(edit.wilayaCode));
  diff("Commune", doc.commune, edit.commune);
  diff(
    "Livraison",
    DELIVERY_TYPE_LABELS[doc.deliveryType],
    DELIVERY_TYPE_LABELS[edit.deliveryType],
  );
  if (doc.address !== edit.address) changes.push("Adresse modifiée");
  if (changes.length) diff("Total", formatPrice(doc.total), formatPrice(newTotal));
  return changes;
}

/**
 * Edits an order before it is shipped (after the call: other size, color, quantity,
 * wilaya, address…). Every amount is recomputed with the shared helpers (unit price kept
 * as agreed), and the stock is adjusted atomically: the new variant is taken first, the
 * old one given back once the order is saved.
 */
export async function editOrder(
  id: string,
  edit: AdminOrderEdit,
  admin: Admin,
): Promise<AdminOrder> {
  const doc = await loadOrder(id);
  if (!EDITABLE_STATUSES.includes(doc.status)) {
    throw new HttpError(
      409,
      "Cette commande est déjà expédiée ou fermée : elle ne peut plus être modifiée.",
    );
  }
  const product = await loadProduct(doc.item.productId, { includeInactive: true });
  if (!product)
    throw new HttpError(409, "Ce produit n'existe plus : la commande ne peut pas être modifiée.");
  if (!product.colors.some((color) => color.name === edit.color)) {
    const message = "Cette couleur n'est pas disponible pour ce produit.";
    throw new HttpError(400, message, { color: message });
  }

  const pricing = await priceOrder(product, edit, doc.item.unitPrice, {
    rejectSuspended: edit.wilayaCode !== doc.wilayaCode,
  });
  const fields = {
    fullName: edit.fullName,
    phone: edit.phone,
    wilayaCode: edit.wilayaCode,
    commune: edit.commune,
    address: edit.address,
    deliveryType: edit.deliveryType,
    item: pricing.item,
    subtotal: pricing.subtotal,
    ...pricing.delivery,
    total: pricing.total,
  };
  // The amounts must add up, exactly as for a new order.
  orderSummarySchema.parse({ ...toOrderSummary(doc), ...fields });

  const changes = describeChanges(doc, edit, pricing.total);
  if (changes.length === 0) return toAdminOrderOne(doc);

  const before = variantOf(doc);
  const after: Variant = {
    productId: before.productId,
    color: edit.color,
    size: edit.size,
    quantity: edit.quantity,
  };
  const sameVariant = before.color === after.color && before.size === after.size;
  const delta = sameVariant ? after.quantity - before.quantity : after.quantity;
  const adjustStock = doc.stockReserved;

  if (adjustStock && delta > 0) {
    const taken = await reserveStock({ ...after, quantity: delta }, { includeInactive: true });
    if (!taken) {
      throw await stockError(after, {
        heldQuantity: sameVariant ? before.quantity : 0,
        includeInactive: true,
      });
    }
  }

  const updated = await OrderModel.findOneAndUpdate(
    { _id: doc._id, status: { $in: EDITABLE_STATUSES }, updatedAt: doc.updatedAt },
    {
      $set: fields,
      $push: { history: historyLine(admin, "edit", `Commande modifiée : ${changes.join(", ")}.`) },
    },
    { returnDocument: "after" },
  ).lean<OrderDoc>();
  if (!updated) {
    if (adjustStock && delta > 0) await releaseStock({ ...after, quantity: delta });
    throw new HttpError(409, CONFLICT);
  }

  if (adjustStock) {
    if (sameVariant && delta < 0) await releaseStock({ ...after, quantity: -delta });
    if (!sameVariant) await releaseStock(before);
  }
  logger.info("Order edited", { orderNumber: doc.orderNumber, by: admin.email, changes });
  return toAdminOrderOne(updated);
}

// ---------- Note and blacklist ----------

export async function setNote(id: string, note: string): Promise<AdminOrder> {
  const updated = await OrderModel.findByIdAndUpdate(
    parseId(id),
    { $set: { adminNote: note } },
    { returnDocument: "after" },
  ).lean<OrderDoc>();
  if (!updated) throw new HttpError(404, ORDER_NOT_FOUND);
  return toAdminOrderOne(updated);
}

/** Adds the order's phone to the blacklist (or updates the reason). */
export async function blacklistOrderPhone(
  id: string,
  reason: string,
  admin: Admin,
): Promise<AdminOrder> {
  const doc = await loadOrder(id);
  await addToBlacklist(doc.phone, reason, admin);
  const updated = await OrderModel.findByIdAndUpdate(
    doc._id,
    {
      $push: {
        history: historyLine(admin, "blacklist", `Numéro ajouté à la liste noire : ${reason}.`),
      },
    },
    { returnDocument: "after" },
  ).lean<OrderDoc>();
  return toAdminOrderOne(updated ?? doc);
}

export async function addToBlacklist(phone: string, reason: string, admin: Admin): Promise<void> {
  await BlacklistModel.updateOne(
    { phone },
    { $set: { reason }, $setOnInsert: { phone, createdBy: admin.email } },
    { upsert: true },
  );
  logger.info("Phone blacklisted", { by: admin.email });
}

export async function listBlacklist() {
  const entries = await BlacklistModel.find().sort({ createdAt: -1 }).lean<BlacklistDoc[]>();
  const counts = await OrderModel.aggregate<{ _id: string; count: number }>([
    { $match: { phone: { $in: entries.map((entry) => entry.phone) } } },
    { $group: { _id: "$phone", count: { $sum: 1 } } },
  ]);
  const byPhone = new Map(counts.map((row) => [row._id, row.count]));
  return entries.map((entry) => ({
    phone: entry.phone,
    reason: entry.reason,
    createdAt: entry.createdAt.toISOString(),
    createdBy: entry.createdBy,
    orderCount: byPhone.get(entry.phone) ?? 0,
  }));
}

export async function removeFromBlacklist(phone: string): Promise<boolean> {
  const { deletedCount } = await BlacklistModel.deleteOne({ phone });
  return deletedCount === 1;
}

/** Confirmed orders to export (chosen ids, or every confirmed order), oldest first. */
export async function confirmedOrdersForExport(ids: readonly string[] | undefined, all: boolean) {
  const filter: QueryFilter<OrderDoc> = { status: "confirmed" };
  if (!all)
    filter._id = {
      $in: (ids ?? [])
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id)),
    };
  return OrderModel.find(filter).sort({ createdAt: 1 }).lean<OrderDoc[]>();
}
