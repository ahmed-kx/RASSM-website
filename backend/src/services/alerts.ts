import type { Size } from "@rassm/shared";
import { AlertLogModel } from "../models/alert-log";
import { OrderModel } from "../models/order";
import { ProductModel, type ProductDoc } from "../models/product";
import type { TeamAlert } from "../notifications/alert-email";

// Alerts to the team about possible fake orders. Each one is e-mailed once per period: the first
// request that records it (an insert with a fixed id) sends it.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A variant that loses more than this share of its stock within an hour… */
export const STOCK_DROP_SHARE = 0.5;
/** …and at least this many units (no alert when the last unit or two of a size sell normally). */
export const STOCK_DROP_MIN_UNITS = 3;

/** True for the first caller of this key in the period (it sends the alert). */
export async function claimAlert(key: string, periodMs: number, now = new Date()) {
  try {
    await AlertLogModel.create({
      _id: key,
      sentAt: now,
      expiresAt: new Date(now.getTime() + periodMs),
    });
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      // Still there after its period (the TTL index runs once a minute): start a new one.
      const renewed = await AlertLogModel.updateOne(
        { _id: key, expiresAt: { $lte: now } },
        { $set: { sentAt: now, expiresAt: new Date(now.getTime() + periodMs) } },
      );
      return renewed.modifiedCount === 1;
    }
    throw error;
  }
}

/** One alert per IP per 24 hours. */
export async function ipAlert(
  alert: Extract<TeamAlert, { kind: "ip" }>,
  now = new Date(),
): Promise<TeamAlert | null> {
  return (await claimAlert(`ip:${alert.ip}`, DAY_MS, now)) ? alert : null;
}

/**
 * After an order took units of a variant: the alert when the units ordered in the last hour
 * (orders not cancelled) are more than half of the stock the variant had an hour ago (now + those
 * units). One alert per variant per hour.
 */
export async function stockDropAlert(
  variant: { productId: string; color: string; size: Size },
  now = new Date(),
): Promise<TeamAlert | null> {
  const [product, [ordered]] = await Promise.all([
    ProductModel.findById(variant.productId, { name: 1, colors: 1 }).lean<
      Pick<ProductDoc, "name" | "colors">
    >(),
    OrderModel.aggregate<{ units: number }>([
      {
        $match: {
          "item.productId": variant.productId,
          "item.color": variant.color,
          "item.size": variant.size,
          status: { $ne: "cancelled" },
          createdAt: { $gte: new Date(now.getTime() - HOUR_MS) },
        },
      },
      { $group: { _id: null, units: { $sum: "$item.quantity" } } },
    ]),
  ]);
  const remaining = product?.colors.find((color) => color.name === variant.color)?.stock[
    variant.size
  ];
  const lost = ordered?.units ?? 0;
  if (!product || remaining === undefined || lost < STOCK_DROP_MIN_UNITS) return null;
  const before = remaining + lost;
  if (lost <= before * STOCK_DROP_SHARE) return null;
  const key = `stock:${variant.productId}:${variant.color}:${variant.size}`;
  if (!(await claimAlert(key, HOUR_MS, now))) return null;
  return {
    kind: "stock",
    productId: variant.productId,
    productName: product.name,
    color: variant.color,
    size: variant.size,
    lost,
    before,
    remaining,
  };
}
