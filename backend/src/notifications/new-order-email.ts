import { DELIVERY_TYPE_LABELS, formatPrice, formatWilaya, getWilaya } from "@rassm/shared";
import { describeError, logger } from "../lib/logger";
import { OrderModel, type MetaEventStatus, type OrderDoc } from "../models/order";
import { buildAlertEmail, type TeamAlert } from "./alert-email";
import { formatPhone, renderTeamEmail, sendTeamEmail, type EmailConfig } from "./brevo";

export type { EmailConfig } from "./brevo";

// New order e-mail to the team, through the Brevo transactional API. Sent in the
// background: a Brevo failure is logged (and stored on the order), never blocking it.

export type NewOrderEmailOrder = Pick<
  OrderDoc,
  | "_id"
  | "orderNumber"
  | "fullName"
  | "phone"
  | "wilayaCode"
  | "commune"
  | "address"
  | "deliveryType"
  | "item"
  | "subtotal"
  | "deliveryFee"
  | "deliveryDiscount"
  | "freeDelivery"
  | "total"
  | "suspicious"
  | "suspiciousReason"
>;

export interface NewOrderFlags {
  /** Reason when the phone is on the blacklist. */
  blacklistReason: string | null;
}

export interface OrderNotifier {
  /** Sends the new order e-mail; records the result on the order. Never throws. */
  notifyNewOrder(order: NewOrderEmailOrder, flags: NewOrderFlags): Promise<void>;
  /** Sends an alert to the team (many orders from one IP, stock dropping fast). Never throws. */
  notifyAlert(alert: TeamAlert): Promise<void>;
}

export function orderLink(adminUrl: string, orderId: string): string {
  return `${adminUrl}/commandes/${orderId}`;
}

/** Subject, HTML and plain text of the e-mail (French). */
export function buildNewOrderEmail(
  order: NewOrderEmailOrder,
  flags: NewOrderFlags,
  adminUrl: string,
) {
  const wilaya = getWilaya(order.wilayaCode);
  const wilayaLabel = wilaya ? formatWilaya(wilaya) : String(order.wilayaCode);
  const product = `${order.item.name} · ${order.item.color} · ${order.item.size} · × ${order.item.quantity}`;
  const delivery = order.freeDelivery ? "Livraison gratuite" : formatPrice(order.deliveryFee);
  const link = orderLink(adminUrl, order._id.toString());
  const flagLines = [
    ...(flags.blacklistReason ? [`Liste noire : ${flags.blacklistReason}`] : []),
    ...(order.suspicious ? [`Suspecte : ${order.suspiciousReason ?? ""}`] : []),
  ];

  const rows: [string, string][] = [
    ["Client", order.fullName],
    ["Téléphone", formatPhone(order.phone)],
    ["Wilaya", wilayaLabel],
    ["Commune", order.commune],
    ["Livraison", DELIVERY_TYPE_LABELS[order.deliveryType]],
    ...(order.deliveryType === "home" ? ([["Adresse", order.address]] as [string, string][]) : []),
    ["Produit", order.item.name],
    ["Couleur", order.item.color],
    ["Taille", order.item.size],
    ["Quantité", String(order.item.quantity)],
    ["Articles", formatPrice(order.subtotal)],
    ["Livraison (frais)", delivery],
    ["Total à encaisser", formatPrice(order.total)],
  ];

  const subject = `${flags.blacklistReason ? "[Liste noire] " : order.suspicious ? "[Suspecte] " : ""}Nouvelle commande : ${order.item.name}, ${formatPrice(order.total)}`;

  const html = renderTeamEmail({
    eyebrow: `Nouvelle commande · ${order.orderNumber}`,
    title: product,
    flags: flagLines,
    rows,
    strongLast: true,
    button: { label: "Ouvrir la commande", href: link },
    footer: "Commande reçue, à confirmer par téléphone.",
  });

  const text = [
    `Nouvelle commande ${order.orderNumber}`,
    ...flagLines,
    "",
    ...rows.map(([label, value]) => `${label} : ${value}`),
    "",
    `Ouvrir la commande : ${link}`,
  ].join("\n");

  return { subject, html, text };
}

async function record(orderId: NewOrderEmailOrder["_id"], status: MetaEventStatus, error?: string) {
  await OrderModel.updateOne(
    { _id: orderId },
    {
      $set: {
        "emailNotification.status": status,
        ...(status === "sent" && { "emailNotification.sentAt": new Date() }),
        ...(error && { "emailNotification.error": error.slice(0, 500) }),
      },
    },
  ).catch((dbError: unknown) =>
    logger.error("Could not record the e-mail status", describeError(dbError)),
  );
}

/** Brevo notifier. Does nothing (status "skipped") without BREVO_API_KEY. */
export function createOrderNotifier(config: EmailConfig | null): OrderNotifier {
  return {
    async notifyNewOrder(order, flags) {
      if (!config) {
        await record(order._id, "skipped");
        return;
      }
      const { subject, html, text } = buildNewOrderEmail(order, flags, config.adminUrl);
      try {
        await sendTeamEmail(config, { subject, html, text });
        await record(order._id, "sent");
        logger.info("New order e-mail sent", { orderNumber: order.orderNumber });
      } catch (error) {
        logger.error("New order e-mail failed", {
          orderNumber: order.orderNumber,
          ...describeError(error),
        });
        await record(order._id, "failed", error instanceof Error ? error.message : String(error));
      }
    },
    async notifyAlert(alert) {
      if (!config) {
        logger.warn("Team alert not sent: BREVO_API_KEY is not set", { kind: alert.kind });
        return;
      }
      try {
        await sendTeamEmail(config, buildAlertEmail(alert, config.adminUrl));
        logger.info("Team alert sent", { kind: alert.kind });
      } catch (error) {
        logger.error("Team alert failed", { kind: alert.kind, ...describeError(error) });
      }
    },
  };
}
