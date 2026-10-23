import {
  DELIVERY_TYPES,
  META_CONFIRMED_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  SIZES,
  orderSchema,
  orderSummarySchema,
  type DeliveryDiscountLine,
  type MetaConfirmedStatus,
  type MetaTracking,
  type Order,
  type OrderItem,
  type OrderStatus,
  type OrderSummary,
} from "@rassm/shared";
import { Schema, model, type Types } from "mongoose";

export type MetaEventStatus = "pending" | "sent" | "failed" | "skipped";

/** An order as stored: the shared Order plus internal data the customer never sees. */
export interface OrderDoc extends Omit<Order, "id" | "createdAt" | "item"> {
  _id: Types.ObjectId;
  /** The ordered product, plus its cost price when the order was placed (admin only). */
  item: OrderItem & { unitCost?: number | null };
  /**
   * Packaging and return costs (settings) copied when the order becomes delivered or
   * returned, so a later change of the settings never rewrites past profit.
   */
  costs?: { packaging?: number | null; returnCost?: number | null };
  createdAt: Date;
  updatedAt: Date;
  /** Who placed it (fraud checks, Meta Conversions API). */
  client: { ip: string | null; userAgent: string | null };
  /** Meta browser data (fbp/fbc cookies, page URL) for the Conversions API. Absent when none was sent. */
  tracking?: MetaTracking;
  /** Flagged for the dashboard (never blocked): e.g. many orders from the same phone. */
  suspicious: boolean;
  /** French, for the dashboard: why the order was flagged. */
  suspiciousReason: string | null;
  /** Marked "Commande de test" by the team (never sent to Meta as a confirmed order). */
  test?: boolean;
  /** Server-side Purchase event (Conversions API). */
  metaPurchase: { status: MetaEventStatus; sentAt?: Date; error?: string };
  /**
   * Server-side ConfirmedOrder event, sent once per order (services/meta-confirmed.ts). Absent
   * until the order is first confirmed.
   */
  metaConfirmed?: {
    status?: MetaConfirmedStatus;
    /** When the order was confirmed (the event time). */
    confirmedAt?: Date;
    /** When it was sent, failed or skipped. */
    at?: Date;
    /** French: why it failed or was not sent. */
    detail?: string;
  };
  /** New order e-mail to the team (Brevo). */
  emailNotification: { status: MetaEventStatus; sentAt?: Date; error?: string };
  /**
   * True while the ordered units are taken from the stock. Cancelled / returned orders
   * give them back exactly once (the flag flips first, atomically).
   */
  stockReserved: boolean;
  /** Null until an admin opens the order (the "Nouveau" badge). */
  openedAt: Date | null;
  /** Internal note of the team (e.g. "client rappelle ce soir"). */
  adminNote: string;
  /** Every change: creation, status, edits, blacklist. */
  history: OrderHistoryDoc[];
}

export interface OrderHistoryDoc {
  at: Date;
  by: string | null;
  type: "created" | "status" | "edit" | "blacklist";
  status?: OrderStatus;
  message: string;
}

const itemSchema = new Schema(
  {
    productId: { type: String, required: true },
    color: { type: String, required: true },
    size: { type: String, enum: SIZES, required: true },
    quantity: { type: Number, required: true, min: 1 },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    image: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    /** Cost price of one unit when the order was placed (null = unknown, "coût manquant"). */
    unitCost: { type: Number, min: 0, default: null },
  },
  { _id: false },
);

/** Tier applied per product (copied from the shared delivery helper). */
const discountLineSchema = new Schema<DeliveryDiscountLine>(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    tier: {
      type: { type: String, enum: ["amount", "free"], required: true },
      minQuantity: { type: Number, required: true },
      amount: Number,
    },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const orderMongooseSchema = new Schema<OrderDoc>(
  {
    /** Internal number, e.g. RSM-000123 (admin dashboard). Never shown to customers. */
    orderNumber: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    wilayaCode: { type: Number, required: true },
    commune: { type: String, required: true },
    address: { type: String, default: "" },
    deliveryType: { type: String, enum: DELIVERY_TYPES, required: true },
    item: { type: itemSchema, required: true },
    subtotal: { type: Number, required: true },
    deliveryFeeBase: { type: Number, required: true },
    deliveryDiscount: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    freeDelivery: { type: Boolean, required: true },
    deliveryDiscountLines: { type: [discountLineSchema], default: [] },
    total: { type: Number, required: true },
    costs: {
      packaging: { type: Number, min: 0 },
      returnCost: { type: Number, min: 0 },
    },
    // New orders are always "pending" (reçue): confirmed only after the phone call.
    status: { type: String, enum: ORDER_STATUSES, default: "pending" },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash_on_delivery" },
    client: {
      ip: { type: String, default: null },
      userAgent: { type: String, default: null },
    },
    tracking: {
      fbp: String,
      fbc: String,
      eventSourceUrl: String,
    },
    suspicious: { type: Boolean, default: false },
    suspiciousReason: { type: String, default: null },
    test: { type: Boolean, default: false },
    metaPurchase: {
      status: { type: String, enum: ["pending", "sent", "failed", "skipped"], default: "pending" },
      sentAt: Date,
      error: String,
    },
    metaConfirmed: {
      status: { type: String, enum: META_CONFIRMED_STATUSES },
      confirmedAt: Date,
      at: Date,
      detail: String,
    },
    emailNotification: {
      status: { type: String, enum: ["pending", "sent", "failed", "skipped"], default: "pending" },
      sentAt: Date,
      error: String,
    },
    stockReserved: { type: Boolean, default: true },
    openedAt: { type: Date, default: null },
    adminNote: { type: String, default: "" },
    history: {
      type: [
        new Schema<OrderHistoryDoc>(
          {
            at: { type: Date, required: true },
            by: { type: String, default: null },
            type: {
              type: String,
              enum: ["created", "status", "edit", "blacklist"],
              required: true,
            },
            status: { type: String, enum: ORDER_STATUSES },
            message: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, versionKey: false },
);

orderMongooseSchema.index({ status: 1, createdAt: -1 });
orderMongooseSchema.index({ createdAt: -1 });
// Duplicate detection (same phone + product) and fraud checks (orders per phone / IP in 24 h).
orderMongooseSchema.index({ phone: 1, createdAt: -1 });
orderMongooseSchema.index({ phone: 1, "item.productId": 1, createdAt: -1 });
orderMongooseSchema.index({ "client.ip": 1, createdAt: -1 });
orderMongooseSchema.index({ suspicious: 1, createdAt: -1 });
orderMongooseSchema.index({ wilayaCode: 1, createdAt: -1 });
orderMongooseSchema.index({ openedAt: 1, status: 1 });

/**
 * Orders marked "Commande de test" are only shown in the orders list (grey "Test" pill, "Commandes
 * de test" filter). Every statistic, the clients, the exports and the best sellers leave them out:
 * put this in the first $match of such a query.
 */
export const REAL_ORDERS = { test: { $ne: true } } as const;

export const OrderModel = model<OrderDoc>("Order", orderMongooseSchema);

type OrderSource = Pick<
  OrderDoc,
  | "fullName"
  | "phone"
  | "wilayaCode"
  | "commune"
  | "address"
  | "deliveryType"
  | "item"
  | "subtotal"
  | "deliveryFeeBase"
  | "deliveryDiscount"
  | "deliveryFee"
  | "freeDelivery"
  | "deliveryDiscountLines"
  | "total"
  | "status"
  | "paymentMethod"
  | "createdAt"
>;

/** What the customer sees on /merci: no id, no order number. Validated (amounts add up). */
export function toOrderSummary(doc: OrderSource): OrderSummary {
  return orderSummarySchema.parse({
    fullName: doc.fullName,
    phone: doc.phone,
    wilayaCode: doc.wilayaCode,
    commune: doc.commune,
    address: doc.address,
    deliveryType: doc.deliveryType,
    item: {
      productId: doc.item.productId,
      color: doc.item.color,
      size: doc.item.size,
      quantity: doc.item.quantity,
      name: doc.item.name,
      slug: doc.item.slug,
      image: doc.item.image,
      unitPrice: doc.item.unitPrice,
    },
    subtotal: doc.subtotal,
    deliveryFeeBase: doc.deliveryFeeBase,
    deliveryDiscount: doc.deliveryDiscount,
    deliveryFee: doc.deliveryFee,
    freeDelivery: doc.freeDelivery,
    deliveryDiscountLines: doc.deliveryDiscountLines,
    total: doc.total,
    status: doc.status,
    paymentMethod: doc.paymentMethod,
    createdAt: doc.createdAt.toISOString(),
  });
}

/** The full shared Order (admin dashboard later). */
export function toOrder(doc: OrderDoc): Order {
  return orderSchema.parse({
    ...toOrderSummary(doc),
    id: doc._id.toString(),
    orderNumber: doc.orderNumber,
  });
}
