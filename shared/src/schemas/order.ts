import { z } from "zod";
import { cartItemSchema, getCartSubtotal } from "./cart";
import { checkoutFieldsSchema, refineAddressForHomeDelivery } from "./checkout";
import { idSchema, isoDateSchema, priceDaSchema } from "./common";
import { deliveryDiscountLineSchema } from "./delivery-discount";

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

export const orderSchema = checkoutFieldsSchema
  .extend({
    id: idSchema,
    orderNumber: orderNumberSchema,
    items: z.array(cartItemSchema).min(1, "Une commande doit contenir au moins un article."),
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
  })
  .superRefine((order, ctx) => {
    refineAddressForHomeDelivery(order, ctx);
    if (order.subtotal !== getCartSubtotal(order.items)) {
      ctx.addIssue({
        code: "custom",
        path: ["subtotal"],
        message: "Le sous-total ne correspond pas aux articles.",
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
  });
export type Order = z.infer<typeof orderSchema>;
