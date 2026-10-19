import {
  getDeliveryFeeWithDiscount,
  getOrderSubtotal,
  orderSchema,
  productOrderSchema,
  type Order,
  type ProductOrder,
} from "@rassm/shared";
import { mockDeliveryFees, mockProducts } from "@rassm/shared/mocks";

// Orders placed from the product page. No backend yet: the order is checked and priced
// here as the API will do it (shared schemas and delivery helper, product and fee data
// loaded on our side, nothing trusted from the form), then kept in sessionStorage so
// the thank-you page can show it. In the "connect" step these functions call the API.

const STORAGE_PREFIX = "rassm-order:";

/** A French error the order form shows above the button. */
export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

function createOrderNumber(): string {
  return `RSM-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
}

/** Validates, prices and saves the order. Resolves with the stored order. */
export async function placeProductOrder(input: ProductOrder): Promise<Order> {
  // Simulated network delay.
  await new Promise((resolve) => setTimeout(resolve, 700));

  const data = productOrderSchema.parse(input);
  const product = mockProducts.find((candidate) => candidate.id === data.productId);
  if (!product || !product.isActive) {
    throw new OrderError("Ce produit n'est plus disponible.");
  }
  if (!product.colors.some((color) => color.name === data.color)) {
    throw new OrderError("Cette couleur n'est pas disponible pour ce produit.");
  }
  const stock = product.stock[data.size];
  if (stock === 0) {
    throw new OrderError(`La taille ${data.size} est épuisée.`);
  }
  if (data.quantity > stock) {
    throw new OrderError(
      `Il ne reste que ${stock} article${stock > 1 ? "s" : ""} en taille ${data.size}.`,
    );
  }

  const { productId, color, size, quantity, ...customer } = data;
  const item = {
    productId,
    color,
    size,
    quantity,
    name: product.name,
    slug: product.slug,
    image: product.images[0] ?? "",
    unitPrice: product.price,
  };
  // Throws a French DeliveryTypeUnavailableError for stop desk where there is none.
  const { nextDeliveryDiscountTiers: _next, ...delivery } = getDeliveryFeeWithDiscount({
    wilayaCode: customer.wilayaCode,
    deliveryType: customer.deliveryType,
    items: [item],
    products: [product],
    deliveryFees: mockDeliveryFees,
  });
  const subtotal = getOrderSubtotal(item);
  const orderNumber = createOrderNumber();

  const order = orderSchema.parse({
    ...customer,
    id: `order_${orderNumber}`,
    orderNumber,
    item,
    subtotal,
    ...delivery,
    total: subtotal + delivery.deliveryFee,
    status: "pending",
    paymentMethod: "cash_on_delivery",
    createdAt: new Date().toISOString(),
  });

  try {
    sessionStorage.setItem(STORAGE_PREFIX + orderNumber, JSON.stringify(order));
  } catch {
    // Storage unavailable (private mode): the thank-you page shows the number only.
  }
  return order;
}

/** The order with this number, or null when it is unknown. */
export async function getOrder(orderNumber: string): Promise<Order | null> {
  try {
    const saved = sessionStorage.getItem(STORAGE_PREFIX + orderNumber);
    const parsed = saved ? orderSchema.safeParse(JSON.parse(saved)) : null;
    return parsed?.success ? parsed.data : null;
  } catch {
    return null;
  }
}
