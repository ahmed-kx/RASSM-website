import { randomBytes } from "node:crypto";
import {
  DeliveryTypeUnavailableError,
  createProductOrderSchema,
  getDeliveryFeeWithDiscount,
  getOrderSubtotal,
  orderRequestSchema,
  orderSummarySchema,
  refineVariantStock,
  type OrderItem,
  type OrderSummary,
  type PlacedOrder,
  type ProductOrder,
} from "@rassm/shared";
import { z } from "zod";
import type { ClientInfo } from "../lib/client-info";
import { HttpError, issuesToFields, parseOrThrow } from "../lib/http-error";
import { describeError, logger } from "../lib/logger";
import type { MetaEvents } from "../meta/conversions-api";
import { nextOrderNumber } from "../models/counter";
import { loadDeliveryFees } from "../models/delivery-fee";
import { OrderModel, toOrderSummary } from "../models/order";
import { ProductModel, toProduct, type ProductDoc } from "../models/product";
import { assessOrder, findDuplicateOrder } from "./fraud";

const PRODUCT_UNAVAILABLE = "Ce produit n'est plus disponible.";
const STOCK_CHANGED =
  "Le stock de cet article vient de changer : vérifiez la couleur, la taille et la quantité.";

export interface PlaceOrderContext {
  client: ClientInfo;
  metaEvents: MetaEvents;
  now?: Date;
}

/** The product as stored, if it exists and is on sale. */
async function loadActiveProduct(productId: string) {
  const doc = await ProductModel.findOne({ _id: productId, isActive: true }).lean<ProductDoc>();
  return doc ? toProduct(doc) : null;
}

/** French error for a variant that is no longer available, from the current stock. */
async function stockError(order: ProductOrder): Promise<HttpError> {
  const product = await loadActiveProduct(order.productId);
  if (!product) return new HttpError(409, PRODUCT_UNAVAILABLE, { productId: PRODUCT_UNAVAILABLE });
  const result = z
    .object({ color: z.string(), size: z.string(), quantity: z.number() })
    .superRefine(refineVariantStock(product))
    .safeParse(order);
  const fields = result.success ? { quantity: STOCK_CHANGED } : issuesToFields(result.error.issues);
  return new HttpError(409, Object.values(fields)[0] ?? STOCK_CHANGED, fields);
}

/**
 * Takes the ordered units from the stock of this color + size, only if enough are left.
 * A single conditional update: two orders can never both take the last unit.
 */
async function reserveStock(order: ProductOrder): Promise<boolean> {
  const { matchedCount } = await ProductModel.updateOne(
    {
      _id: order.productId,
      isActive: true,
      colors: {
        $elemMatch: { name: order.color, [`stock.${order.size}`]: { $gte: order.quantity } },
      },
    },
    { $inc: { [`colors.$.stock.${order.size}`]: -order.quantity } },
  );
  return matchedCount === 1;
}

async function releaseStock(order: ProductOrder): Promise<void> {
  await ProductModel.updateOne(
    { _id: order.productId, "colors.name": order.color },
    { $inc: { [`colors.$.stock.${order.size}`]: order.quantity } },
  );
}

const placed = (order: OrderSummary, eventId: string): PlacedOrder => ({ order, eventId });

/**
 * Places an order from the product page. Everything is checked and priced here from the
 * database (product, stock, delivery fees, discount tiers): nothing sent by the client
 * about prices is ever used. New orders are "pending" (reçue) until the phone call.
 */
export async function placeOrder(body: unknown, context: PlaceOrderContext): Promise<PlacedOrder> {
  const now = context.now ?? new Date();
  const request = parseOrThrow(orderRequestSchema, body, "order");
  const product = await loadActiveProduct(request.order.productId);
  if (!product) throw new HttpError(409, PRODUCT_UNAVAILABLE, { productId: PRODUCT_UNAVAILABLE });

  // Shared rules plus this product's colors and stock per color + size.
  const order = parseOrThrow(createProductOrderSchema(product), request.order);

  const item: OrderItem = {
    productId: product.id,
    color: order.color,
    size: order.size,
    quantity: order.quantity,
    name: product.name,
    slug: product.slug,
    image:
      product.colors.find((color) => color.name === order.color)?.images?.[0] ??
      product.images[0] ??
      "",
    unitPrice: product.price,
  };

  let delivery;
  try {
    const { nextDeliveryDiscountTiers: _next, ...breakdown } = getDeliveryFeeWithDiscount({
      wilayaCode: order.wilayaCode,
      deliveryType: order.deliveryType,
      items: [item],
      products: [product],
      deliveryFees: await loadDeliveryFees(),
    });
    delivery = breakdown;
  } catch (error) {
    if (error instanceof DeliveryTypeUnavailableError) {
      throw new HttpError(400, error.message, { deliveryType: error.message });
    }
    throw error;
  }

  const subtotal = getOrderSubtotal(item);
  // Validated: the amounts must add up (subtotal, delivery, discount, total).
  const summary = orderSummarySchema.parse({
    fullName: order.fullName,
    phone: order.phone,
    wilayaCode: order.wilayaCode,
    commune: order.commune,
    address: order.address,
    deliveryType: order.deliveryType,
    item,
    subtotal,
    ...delivery,
    total: subtotal + delivery.deliveryFee,
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
    const [orderNumber, flag] = await Promise.all([
      nextOrderNumber(),
      assessOrder(order.phone, context.client.ip, now),
    ]);
    const doc = await OrderModel.create({
      ...summary,
      createdAt: now,
      orderNumber,
      client: context.client,
      tracking: request.tracking ?? {},
      ...flag,
    });
    logger.info("Order placed", { orderNumber, total: summary.total, suspicious: flag.suspicious });

    // Background: Meta must never slow down or fail the order.
    void context.metaEvents
      .sendPurchase(doc.toObject())
      .catch((error: unknown) => logger.error("Meta Purchase event crashed", describeError(error)));
    return placed(toOrderSummary(doc), doc._id.toString());
  } catch (error) {
    // The order was not saved: give the units back.
    await releaseStock(order).catch((releaseError: unknown) =>
      logger.error("Could not release stock after a failed order", describeError(releaseError)),
    );
    throw error;
  }
}
