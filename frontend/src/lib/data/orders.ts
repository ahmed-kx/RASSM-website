import {
  API_PATHS,
  placedOrderSchema,
  type MetaTracking,
  type PlacedOrder,
  type ProductOrder,
} from "@rassm/shared";
import { ApiError, apiPost } from "@/lib/api";

// Orders placed from the product page. The API checks everything again and prices the
// order from the database (product, stock per color + size, delivery fees, discounts):
// only the customer's choices are sent, never a price. The answer is kept in
// sessionStorage so /merci can show the summary. The order number stays internal.

/** The last order placed on this device, read back by /merci. */
const LAST_ORDER_KEY = "rassm-last-order";

/** A French order error. `fields` maps a form field to its message (e.g. stock). */
export class OrderError extends Error {
  constructor(
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export interface OrderExtras {
  /** Hidden anti-spam field: empty for real customers. */
  website?: string;
  /** Milliseconds between the form appearing and the order (bot check, useFormTimer). */
  elapsedMs?: number;
  /** Meta cookies and page URL, for the server-side Conversions API. */
  tracking?: MetaTracking;
}

/** Sends the order to the API. Resolves with the summary and the Meta event id. */
export async function placeProductOrder(
  order: ProductOrder,
  extras: OrderExtras = {},
): Promise<PlacedOrder> {
  let placed: PlacedOrder;
  try {
    placed = await apiPost(API_PATHS.orders, { order, ...extras }, placedOrderSchema);
  } catch (error) {
    if (error instanceof ApiError) throw new OrderError(error.message, error.fields);
    throw error;
  }
  try {
    sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(placed));
  } catch {
    // Storage unavailable (private mode): the thank-you page shows a generic message.
  }
  return placed;
}

/** The last order placed on this device, or null when there is none. */
export async function getLastOrder(): Promise<PlacedOrder | null> {
  try {
    const saved = sessionStorage.getItem(LAST_ORDER_KEY);
    const parsed = saved ? placedOrderSchema.safeParse(JSON.parse(saved)) : null;
    return parsed?.success ? parsed.data : null;
  } catch {
    return null;
  }
}
