import { formTimingReason } from "@rassm/shared";
import { HttpError } from "../lib/http-error";
import { OrderModel } from "../models/order";

// Fake order checks. Suspicious orders are flagged for the dashboard, never blocked (the team
// decides during the confirmation call), except above hard daily limits per phone number and per
// IP. Phones are always normalised ("0555123456", see normalizeAlgerianPhone) before these checks.
//
// Many mobile customers in Algeria share one IP address (carrier-grade NAT): the IP rules only
// flag and alert at normal volumes, and refuse only far above what real customers order.

/** A second order of the same product from the same phone within this time is a duplicate. */
export const DUPLICATE_ORDER_WINDOW_MS = 30 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Flag from the 3rd order with the same phone number in 24 h. */
export const SUSPICIOUS_ORDERS_PER_PHONE = 3;
/** Flag (and alert the team) when one IP places more than this many orders in 24 h… */
export const SUSPICIOUS_ORDERS_PER_IP = 5;
/** …or more than this many units in 24 h. */
export const SUSPICIOUS_UNITS_PER_IP = 15;
/** Refuse beyond this many units per IP in 24 h (cancelled orders not counted). */
export const MAX_UNITS_PER_IP_PER_DAY = 60;
/** A suspicious order can hold at most this many units (it still reserves its stock). */
export const MAX_SUSPICIOUS_ORDER_QUANTITY = 3;
/**
 * Orders accepted per phone number in 24 h. More are refused (429): a real customer orders one
 * product at a time, and can still reach us on WhatsApp.
 */
export const MAX_ORDERS_PER_PHONE_PER_DAY = 5;
export const PHONE_LIMIT_MESSAGE =
  "Vous avez déjà passé plusieurs commandes aujourd'hui avec ce numéro. Contactez-nous sur WhatsApp pour en ajouter.";
export const IP_UNITS_LIMIT_MESSAGE =
  "Beaucoup d'articles ont déjà été commandés depuis votre connexion aujourd'hui. Contactez-nous sur WhatsApp pour finaliser votre commande.";
export const SUSPICIOUS_QUANTITY_MESSAGE = `Pour cette commande, vous pouvez commander ${MAX_SUSPICIOUS_ORDER_QUANTITY} articles au maximum. Contactez-nous sur WhatsApp pour en commander plus.`;

/** 429 when this phone already placed the daily maximum of orders. */
export async function checkPhoneLimit(phone: string, now: Date): Promise<void> {
  const count = await OrderModel.countDocuments({
    phone,
    createdAt: { $gte: new Date(now.getTime() - DAY_MS) },
  });
  if (count >= MAX_ORDERS_PER_PHONE_PER_DAY) {
    throw new HttpError(429, PHONE_LIMIT_MESSAGE, { phone: PHONE_LIMIT_MESSAGE });
  }
}

/** A recent order of the same product by the same phone (not cancelled), if any. */
export function findDuplicateOrder(phone: string, productId: string, now: Date) {
  return OrderModel.findOne({
    phone,
    "item.productId": productId,
    status: { $ne: "cancelled" },
    createdAt: { $gte: new Date(now.getTime() - DUPLICATE_ORDER_WINDOW_MS) },
  })
    .sort({ createdAt: -1 })
    .lean();
}

/** Orders and units of one IP in the last 24 h (before the new order). */
async function ipActivity(ip: string, since: Date) {
  const [row] = await OrderModel.aggregate<{
    orders: number;
    units: number;
    activeUnits: number;
  }>([
    { $match: { "client.ip": ip, createdAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        units: { $sum: "$item.quantity" },
        activeUnits: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$item.quantity"] },
        },
      },
    },
  ]);
  return row ?? { orders: 0, units: 0, activeUnits: 0 };
}

export interface OrderAssessment {
  suspicious: boolean;
  suspiciousReason: string | null;
  /**
   * Sent too fast or without the site's form: a bot. Its Purchase is not sent to Meta (it would
   * teach the ads to find more bots).
   */
  bot: boolean;
  /** Set when this order makes the IP cross the alert threshold (e-mail to the team). */
  ipAlert: { ip: string; orders: number; units: number } | null;
}

/**
 * Checks a new order before its stock is taken. Refuses it (429) beyond MAX_UNITS_PER_IP_PER_DAY,
 * and a suspicious order of more than MAX_SUSPICIOUS_ORDER_QUANTITY units (409 under the
 * quantity: the customer can order fewer, or write to us). Otherwise returns the flags.
 */
export async function assessOrder(
  order: { phone: string; quantity: number },
  ip: string | null,
  now: Date,
  elapsedMs?: number,
): Promise<OrderAssessment> {
  const since = new Date(now.getTime() - DAY_MS);
  const [phoneCount, activity] = await Promise.all([
    OrderModel.countDocuments({ phone: order.phone, createdAt: { $gte: since } }),
    ip ? ipActivity(ip, since) : null,
  ]);

  if (activity && activity.activeUnits + order.quantity > MAX_UNITS_PER_IP_PER_DAY) {
    throw new HttpError(429, IP_UNITS_LIMIT_MESSAGE);
  }

  const reasons: string[] = [];
  const timing = formTimingReason(elapsedMs);
  if (timing) reasons.push(timing);
  if (phoneCount + 1 >= SUSPICIOUS_ORDERS_PER_PHONE) {
    reasons.push(`${phoneCount + 1} commandes avec ce numéro de téléphone en 24 h`);
  }
  let ipAlert: OrderAssessment["ipAlert"] = null;
  if (ip && activity) {
    const orders = activity.orders + 1;
    const units = activity.units + order.quantity;
    const tooManyOrders = orders > SUSPICIOUS_ORDERS_PER_IP;
    const tooManyUnits = units > SUSPICIOUS_UNITS_PER_IP;
    if (tooManyOrders || tooManyUnits) {
      reasons.push(`${orders} commandes (${units} articles) depuis la même adresse IP en 24 h`);
      // Only the order that crosses a threshold sends the alert (then one per IP per day).
      const crossed =
        (tooManyOrders && activity.orders <= SUSPICIOUS_ORDERS_PER_IP) ||
        (tooManyUnits && activity.units <= SUSPICIOUS_UNITS_PER_IP);
      if (crossed) ipAlert = { ip, orders, units };
    }
  }

  const suspicious = reasons.length > 0;
  if (suspicious && order.quantity > MAX_SUSPICIOUS_ORDER_QUANTITY) {
    throw new HttpError(409, SUSPICIOUS_QUANTITY_MESSAGE, {
      quantity: SUSPICIOUS_QUANTITY_MESSAGE,
    });
  }
  return {
    suspicious,
    suspiciousReason: suspicious ? reasons.join(" ; ") : null,
    bot: timing !== null,
    ipAlert,
  };
}
