import { z } from "zod";
import { idSchema, imageUrlSchema, isoDateSchema, priceDaSchema, slugSchema } from "./common";
import { customerFieldsSchema, refineAddressForHomeDelivery } from "./customer";
import { deliveryDiscountLineSchema } from "./delivery-discount";
import { productOrderFieldsSchema } from "./product-order";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES, { error: "Statut de commande invalide." });
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** French labels (admin dashboard). "pending" = reçue, waiting for the confirmation call. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Reçue",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  returned: "Retournée",
};

export const PAYMENT_METHODS = ["cash_on_delivery"] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS, {
  error: "Seul le paiement à la livraison est accepté.",
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_on_delivery: "Paiement à la livraison",
};

/** e.g. "RSM-000123" */
export const orderNumberSchema = z
  .string()
  .regex(/^RSM-\d{6}$/, 'Le numéro de commande doit avoir la forme "RSM-000123".');

/**
 * The ordered product, with name, image and unit price copied from the product when
 * the order is placed (so the order stays readable if the product changes later).
 */
export const orderItemSchema = productOrderFieldsSchema
  .pick({
    productId: true,
    color: true,
    size: true,
    quantity: true,
  })
  .extend({
    name: z.string().trim().min(1, "Nom du produit manquant."),
    slug: slugSchema,
    image: imageUrlSchema,
    /** Unit price in DA when the order was placed. */
    unitPrice: priceDaSchema,
  });
export type OrderItem = z.infer<typeof orderItemSchema>;

export function getOrderSubtotal(item: Pick<OrderItem, "unitPrice" | "quantity">): number {
  return item.unitPrice * item.quantity;
}

/** Every field of a stored order, without the cross-field checks. */
export const orderFieldsSchema = customerFieldsSchema.extend({
  id: idSchema,
  orderNumber: orderNumberSchema,
  item: orderItemSchema,
  subtotal: priceDaSchema,
  /** Delivery fee before discount. */
  deliveryFeeBase: priceDaSchema,
  /** Delivery discount actually applied (for dashboard stats). */
  deliveryDiscount: priceDaSchema,
  /** Final delivery fee paid: deliveryFeeBase - deliveryDiscount. */
  deliveryFee: priceDaSchema,
  /** True when a product reached a "free delivery" tier. */
  freeDelivery: z.boolean(),
  /** Tier applied per product, as computed by `getDeliveryFeeWithDiscount`. */
  deliveryDiscountLines: z.array(deliveryDiscountLineSchema),
  total: priceDaSchema,
  status: orderStatusSchema,
  paymentMethod: paymentMethodSchema,
  createdAt: isoDateSchema,
});

type OrderAmounts = Omit<z.infer<typeof orderFieldsSchema>, "id" | "orderNumber">;

/** Amounts must add up: subtotal, delivery fee, discount and total. */
function refineOrderAmounts(order: OrderAmounts, ctx: z.RefinementCtx): void {
  refineAddressForHomeDelivery(order, ctx);
  if (order.subtotal !== getOrderSubtotal(order.item)) {
    ctx.addIssue({
      code: "custom",
      path: ["subtotal"],
      message: "Le sous-total doit être égal au prix unitaire multiplié par la quantité.",
    });
  }
  if (order.deliveryDiscount > order.deliveryFeeBase) {
    ctx.addIssue({
      code: "custom",
      path: ["deliveryDiscount"],
      message: "La réduction ne peut pas dépasser le tarif de livraison de base.",
    });
  }
  if (order.deliveryFee !== order.deliveryFeeBase - order.deliveryDiscount) {
    ctx.addIssue({
      code: "custom",
      path: ["deliveryFee"],
      message: "Les frais de livraison doivent être égaux au tarif de base moins la réduction.",
    });
  }
  const hasFreeTier = order.deliveryDiscountLines.some((line) => line.tier.type === "free");
  if (order.freeDelivery !== hasFreeTier) {
    ctx.addIssue({
      code: "custom",
      path: ["freeDelivery"],
      message: "La livraison gratuite ne correspond pas aux paliers appliqués.",
    });
  }
  const expectedDiscount = hasFreeTier
    ? order.deliveryFeeBase
    : Math.min(
        order.deliveryDiscountLines.reduce((sum, line) => sum + line.amount, 0),
        order.deliveryFeeBase,
      );
  if (order.deliveryDiscount !== expectedDiscount) {
    ctx.addIssue({
      code: "custom",
      path: ["deliveryDiscount"],
      message: "La réduction ne correspond pas aux paliers appliqués.",
    });
  }
  if (order.total !== order.subtotal + order.deliveryFee) {
    ctx.addIssue({
      code: "custom",
      path: ["total"],
      message: "Le total doit être égal au sous-total plus les frais de livraison.",
    });
  }
}

/**
 * A stored order: one product (orders are placed from the product page). New orders are
 * `pending` ("reçue"): an order is confirmed only after the confirmation phone call.
 * The order number (RSM-000123) is internal: never shown to customers.
 */
export const orderSchema = orderFieldsSchema.superRefine(refineOrderAmounts);
export type Order = z.infer<typeof orderSchema>;

/**
 * What the customer sees on /merci: the order without its id and its internal number.
 */
export const orderSummarySchema = orderFieldsSchema
  .omit({ id: true, orderNumber: true })
  .superRefine(refineOrderAmounts);
export type OrderSummary = z.infer<typeof orderSummarySchema>;

/**
 * Response of POST /api/orders. `eventId` is the internal order id, used only as the
 * Meta event id (browser Pixel and Conversions API share it so Meta deduplicates them).
 */
export const placedOrderSchema = z.object({
  order: orderSummarySchema,
  eventId: idSchema,
});
export type PlacedOrder = z.infer<typeof placedOrderSchema>;
