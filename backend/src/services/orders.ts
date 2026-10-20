import { randomBytes } from "node:crypto";
import {
  createProductOrderSchema,
  orderRequestSchema,
  orderSummarySchema,
  type OrderSummary,
  type PlacedOrder,
} from "@rassm/shared";
import type { ClientInfo } from "../lib/client-info";
import { HttpError, parseOrThrow } from "../lib/http-error";
import { describeError, logger } from "../lib/logger";
import type { MetaEvents } from "../meta/conversions-api";
import { findBlacklisted } from "../models/blacklist";
import { nextOrderNumber } from "../models/counter";
import { OrderModel, toOrderSummary } from "../models/order";
import { ProductModel } from "../models/product";
import type { OrderNotifier } from "../notifications/new-order-email";
import { assessOrder, findDuplicateOrder } from "./fraud";
import { priceOrder } from "./pricing";
import { PRODUCT_UNAVAILABLE, loadProduct, releaseStock, reserveStock, stockError } from "./stock";

export interface PlaceOrderContext {
  client: ClientInfo;
  metaEvents: MetaEvents;
  notifier: OrderNotifier;
  now?: Date;
}

const placed = (order: OrderSummary, eventId: string): PlacedOrder => ({ order, eventId });

/** Background task: logged when it fails, never awaited by the order. */
function inBackground(task: Promise<void>, what: string) {
  void task.catch((error: unknown) => logger.error(`${what} crashed`, describeError(error)));
}

/**
 * Places an order from the product page. Everything is checked and priced here from the
 * database (product, stock, delivery fees, discount tiers): nothing sent by the client
 * about prices is ever used. New orders are "pending" (reçue) until the phone call.
 */
export async function placeOrder(body: unknown, context: PlaceOrderContext): Promise<PlacedOrder> {
  const now = context.now ?? new Date();
  const request = parseOrThrow(orderRequestSchema, body, "order");
  const product = await loadProduct(request.order.productId);
  if (!product) throw new HttpError(409, PRODUCT_UNAVAILABLE, { productId: PRODUCT_UNAVAILABLE });

  // Shared rules plus this product's colors and stock per color + size.
  const order = parseOrThrow(createProductOrderSchema(product), request.order);
  const pricing = await priceOrder(product, order);

  // Validated: the amounts must add up (subtotal, delivery, discount, total).
  const summary = orderSummarySchema.parse({
    fullName: order.fullName,
    phone: order.phone,
    wilayaCode: order.wilayaCode,
    commune: order.commune,
    address: order.address,
    deliveryType: order.deliveryType,
    item: pricing.item,
    subtotal: pricing.subtotal,
    ...pricing.delivery,
    total: pricing.total,
    status: "pending",
    paymentMethod: "cash_on_delivery",
    createdAt: now.toISOString(),
  });

  // Honeypot filled: a bot. Answer as if it worked, save nothing, touch no stock.
  if (request.website?.trim()) {
    logger.warn("Order honeypot filled: ignored", { ip: context.client.ip });
    return placed(summary, randomBytes(12).toString("hex"));
  }

  // Same phone + same product within 30 minutes: return the first order, create nothing.
  const duplicate = await findDuplicateOrder(order.phone, product.id, now);
  if (duplicate) {
    logger.info("Duplicate order ignored", { orderNumber: duplicate.orderNumber });
    return placed(toOrderSummary(duplicate), duplicate._id.toString());
  }

  if (!(await reserveStock(order))) throw await stockError(order);

  try {
    const [orderNumber, flag, blacklisted, cost] = await Promise.all([
      nextOrderNumber(),
      assessOrder(order.phone, context.client.ip, now),
      findBlacklisted([order.phone]),
      ProductModel.findById(product.id, { costPrice: 1 }).lean<{ costPrice?: number | null }>(),
    ]);
    const blacklistReason = blacklisted.get(order.phone)?.reason ?? null;
    const doc = await OrderModel.create({
      ...summary,
      // Cost price copied now: a later change of the product cost never rewrites past profit.
      item: { ...summary.item, unitCost: cost?.costPrice ?? null },
      createdAt: now,
      orderNumber,
      client: context.client,
      tracking: request.tracking ?? {},
      ...flag,
      stockReserved: true,
      history: [
        {
          at: now,
          by: null,
          type: "created",
          status: "pending",
          message: "Commande reçue sur le site.",
        },
      ],
    });
    logger.info("Order placed", {
      orderNumber,
      total: summary.total,
      suspicious: flag.suspicious,
      blacklisted: blacklistReason !== null,
    });

    // Background: Meta and the e-mail must never slow down or fail the order.
    const saved = doc.toObject();
    inBackground(context.metaEvents.sendPurchase(saved), "Meta Purchase event");
    inBackground(context.notifier.notifyNewOrder(saved, { blacklistReason }), "New order e-mail");
    return placed(toOrderSummary(doc), doc._id.toString());
  } catch (error) {
    // The order was not saved: give the units back.
    await releaseStock(order).catch((releaseError: unknown) =>
      logger.error("Could not release stock after a failed order", describeError(releaseError)),
    );
    throw error;
  }
}
