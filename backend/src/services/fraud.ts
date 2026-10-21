import { formTimingReason } from "@rassm/shared";
import { HttpError } from "../lib/http-error";
import { OrderModel } from "../models/order";

// Fake order checks. Suspicious orders are flagged for the dashboard, never blocked (the team
// decides during the confirmation call), except above a hard daily limit per phone number.
// Phones are always normalised ("0555123456", see normalizeAlgerianPhone) before these checks.

/** A second order of the same product from the same phone within this time is a duplicate. */
export const DUPLICATE_ORDER_WINDOW_MS = 30 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Flag from the 3rd order with the same phone number in 24 h. */
export const SUSPICIOUS_ORDERS_PER_PHONE = 3;
/** Flag from the 5th order from the same IP address in 24 h. */
export const SUSPICIOUS_ORDERS_PER_IP = 5;
/**
 * Orders accepted per phone number in 24 h. More are refused (429): a real customer orders one
 * product at a time, and can still reach us on WhatsApp.
 */
export const MAX_ORDERS_PER_PHONE_PER_DAY = 5;
export const PHONE_LIMIT_MESSAGE =
  "Vous avez déjà passé plusieurs commandes aujourd'hui avec ce numéro. Contactez-nous sur WhatsApp pour en ajouter.";

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

/**
 * Flags: the orders of the last 24 h from this phone and this IP (the new one included), and
 * the time taken to fill the form (bots send at once, or call the API without the form).
 */
export async function assessOrder(
  phone: string,
  ip: string | null,
  now: Date,
  elapsedMs?: number,
): Promise<{ suspicious: boolean; suspiciousReason: string | null }> {
  const since = new Date(now.getTime() - DAY_MS);
  const [phoneCount, ipCount] = await Promise.all([
    OrderModel.countDocuments({ phone, createdAt: { $gte: since } }),
    ip ? OrderModel.countDocuments({ "client.ip": ip, createdAt: { $gte: since } }) : 0,
  ]);
  const reasons: string[] = [];
  const timing = formTimingReason(elapsedMs);
  if (timing) reasons.push(timing);
  if (phoneCount + 1 >= SUSPICIOUS_ORDERS_PER_PHONE) {
    reasons.push(`${phoneCount + 1} commandes avec ce numéro de téléphone en 24 h`);
  }
  if (ipCount + 1 >= SUSPICIOUS_ORDERS_PER_IP) {
    reasons.push(`${ipCount + 1} commandes depuis la même adresse IP en 24 h`);
  }
  return {
    suspicious: reasons.length > 0,
    suspiciousReason: reasons.length ? reasons.join(" ; ") : null,
  };
}
