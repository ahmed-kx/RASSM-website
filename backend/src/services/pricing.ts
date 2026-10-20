import {
  DeliveryTypeUnavailableError,
  WILAYA_SUSPENDED_MESSAGE,
  getDeliveryFeeWithDiscount,
  getOrderSubtotal,
  type DeliveryFeeBreakdown,
  type DeliveryType,
  type OrderItem,
  type Product,
  type Size,
} from "@rassm/shared";
import { HttpError } from "../lib/http-error";
import { loadDeliveryFees } from "../models/delivery-fee";

export interface PricingInput {
  color: string;
  size: Size;
  quantity: number;
  wilayaCode: number;
  deliveryType: DeliveryType;
}

export interface Pricing {
  item: OrderItem;
  subtotal: number;
  delivery: Omit<DeliveryFeeBreakdown, "nextDeliveryDiscountTiers">;
  total: number;
}

/**
 * Prices an order from database data only: the product (tiers), the fee table, and the
 * unit price (the product's current price for a new order, the agreed price for an edit).
 */
export async function priceOrder(
  product: Product,
  input: PricingInput,
  unitPrice = product.price,
  { rejectSuspended = true }: { rejectSuspended?: boolean } = {},
): Promise<Pricing> {
  const deliveryFees = await loadDeliveryFees();
  // A wilaya suspended in the dashboard takes no new orders (an admin edit that keeps the
  // order's wilaya is still allowed).
  if (
    rejectSuspended &&
    deliveryFees.find((fee) => fee.wilayaCode === input.wilayaCode)?.suspended
  ) {
    throw new HttpError(400, WILAYA_SUSPENDED_MESSAGE, { wilayaCode: WILAYA_SUSPENDED_MESSAGE });
  }
  const item: OrderItem = {
    productId: product.id,
    color: input.color,
    size: input.size,
    quantity: input.quantity,
    name: product.name,
    slug: product.slug,
    image:
      product.colors.find((color) => color.name === input.color)?.images?.[0] ??
      product.images[0] ??
      "",
    unitPrice,
  };
  try {
    const { nextDeliveryDiscountTiers: _next, ...delivery } = getDeliveryFeeWithDiscount({
      wilayaCode: input.wilayaCode,
      deliveryType: input.deliveryType,
      items: [item],
      products: [product],
      deliveryFees,
    });
    const subtotal = getOrderSubtotal(item);
    return { item, subtotal, delivery, total: subtotal + delivery.deliveryFee };
  } catch (error) {
    if (error instanceof DeliveryTypeUnavailableError) {
      throw new HttpError(400, error.message, { deliveryType: error.message });
    }
    throw error;
  }
}
