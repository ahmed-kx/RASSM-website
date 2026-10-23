import type { MetaConfirmedStatus, OrderStatus } from "@rassm/shared";
import type { QueryFilter } from "mongoose";
import { describeError, logger } from "../lib/logger";
import type { MetaEvents } from "../meta/conversions-api";
import { findBlacklisted } from "../models/blacklist";
import { OrderModel, type OrderDoc } from "../models/order";

// The Meta "ConfirmedOrder" event (Conversions API), sent once per order when the team confirms
// it by phone. The state lives on the order (`metaConfirmed`), and every step is an atomic
// update, so double clicks or a status going back and forth never send it twice.
//
// - Test orders and blacklisted numbers: never sent ("skipped", with the reason).
// - Suspicious orders: kept "waiting" until shipped, so a suspicious order cancelled after the
//   call never reaches Meta. Sent when shipped, with the time of the confirmation.
// - A Meta failure is recorded ("failed") and logged; it never blocks the status change.

/** States from which the event may still be sent (never sent, or skipped earlier). */
const CLAIMABLE: QueryFilter<OrderDoc> = { "metaConfirmed.status": { $in: [null, "skipped"] } };

async function record(
  id: OrderDoc["_id"],
  from: MetaConfirmedStatus,
  set: { status: "sent" | "failed" | "skipped"; detail?: string },
  now: Date,
) {
  await OrderModel.updateOne(
    { _id: id, "metaConfirmed.status": from },
    {
      $set: {
        "metaConfirmed.status": set.status,
        "metaConfirmed.at": now,
        ...(set.detail ? { "metaConfirmed.detail": set.detail.slice(0, 300) } : {}),
      },
      ...(set.detail ? {} : { $unset: { "metaConfirmed.detail": 1 } }),
    },
  );
}

/** Why this order must never be sent, or null. */
async function skipReason(order: OrderDoc, meta: MetaEvents): Promise<string | null> {
  if (!meta.enabled) return "Meta non configuré";
  if (order.test) return "Commande de test";
  if ((await findBlacklisted([order.phone])).size > 0) return "Numéro sur la liste noire";
  return null;
}

/** Claims the order (atomically) and sends the event; records sent or failed. */
async function send(
  order: OrderDoc,
  from: QueryFilter<OrderDoc>,
  confirmedAt: Date,
  meta: MetaEvents,
) {
  const claimed = await OrderModel.findOneAndUpdate(
    { _id: order._id, ...from },
    {
      $set: { "metaConfirmed.status": "sending", "metaConfirmed.confirmedAt": confirmedAt },
      $unset: { "metaConfirmed.detail": 1, "metaConfirmed.at": 1 },
    },
    { returnDocument: "after" },
  ).lean<OrderDoc>();
  if (!claimed) return;
  try {
    await meta.sendConfirmedOrder(claimed, confirmedAt);
    await record(claimed._id, "sending", { status: "sent" }, new Date());
    logger.info("Meta ConfirmedOrder sent", { orderNumber: claimed.orderNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await record(claimed._id, "sending", { status: "failed", detail: message }, new Date());
    logger.error("Meta ConfirmedOrder failed", {
      orderNumber: claimed.orderNumber,
      ...describeError(error),
    });
  }
}

/**
 * Called after every status change (in the background): confirmed → send (or wait when
 * suspicious), shipped → send a waiting one, cancelled → a waiting one is never sent.
 */
export async function onStatusChanged(
  orderId: OrderDoc["_id"],
  to: OrderStatus,
  meta: MetaEvents,
  now = new Date(),
): Promise<void> {
  const order = await OrderModel.findById(orderId).lean<OrderDoc>();
  if (!order) return;
  const state = order.metaConfirmed?.status;

  if (to === "confirmed" && (state === undefined || state === null || state === "skipped")) {
    const reason = await skipReason(order, meta);
    if (reason) {
      await OrderModel.updateOne(
        { _id: order._id, ...CLAIMABLE },
        {
          $set: {
            "metaConfirmed.status": "skipped",
            "metaConfirmed.at": now,
            "metaConfirmed.detail": reason,
          },
        },
      );
      return;
    }
    if (order.suspicious) {
      await OrderModel.updateOne(
        { _id: order._id, ...CLAIMABLE },
        {
          $set: { "metaConfirmed.status": "waiting", "metaConfirmed.confirmedAt": now },
          $unset: { "metaConfirmed.detail": 1, "metaConfirmed.at": 1 },
        },
      );
      return;
    }
    await send(order, CLAIMABLE, now, meta);
    return;
  }

  if (state !== "waiting") return;
  const confirmedAt = order.metaConfirmed?.confirmedAt ?? now;
  if (to === "shipped") {
    const reason = await skipReason(order, meta);
    if (reason) await record(order._id, "waiting", { status: "skipped", detail: reason }, now);
    else await send(order, { "metaConfirmed.status": "waiting" }, confirmedAt, meta);
  } else if (to === "cancelled") {
    await record(
      order._id,
      "waiting",
      { status: "skipped", detail: "Commande suspecte annulée" },
      now,
    );
  }
}
