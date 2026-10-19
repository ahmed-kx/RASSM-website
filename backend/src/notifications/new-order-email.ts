import { DELIVERY_TYPE_LABELS, formatPrice, formatWilaya, getWilaya } from "@rassm/shared";
import { describeError, logger } from "../lib/logger";
import { OrderModel, type MetaEventStatus, type OrderDoc } from "../models/order";

// New order e-mail to the team, through the Brevo transactional API. Sent in the
// background: a Brevo failure is logged (and stored on the order), never blocking it.

export interface EmailConfig {
  brevoApiKey: string;
  /** Recipient, e.g. rassmwear@gmail.com. */
  notifyEmail: string;
  /** Sender, validated in Brevo. */
  from: string;
  /** Dashboard URL (links to the order). */
  adminUrl: string;
}

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
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

/** "0555123456" → "0555 12 34 56" */
const formatPhone = (phone: string) =>
  phone.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4");

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

  const flagHtml = flagLines
    .map(
      (line) =>
        `<p style="margin:0 0 8px;padding:10px 12px;background:#F6E3DF;color:#9B2C1F;font-size:14px;font-weight:600">${escapeHtml(line)}</p>`,
    )
    .join("");
  const rowsHtml = rows
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #D6D2CA;color:#74706D;font-size:13px;width:42%">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #D6D2CA;color:#111111;font-size:14px;${index === rows.length - 1 ? "font-weight:700;font-size:16px" : ""}">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#F5F2EC;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FBF8F3;border:1px solid #D6D2CA">
<tr><td style="background:#111111;padding:20px 24px;color:#FBF8F3;font-size:22px;letter-spacing:4px">RASSM</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 4px;color:#74706D;font-size:11px;letter-spacing:3px;text-transform:uppercase">Nouvelle commande · ${escapeHtml(order.orderNumber)}</p>
<h1 style="margin:0 0 16px;color:#111111;font-size:22px;font-weight:normal">${escapeHtml(product)}</h1>
${flagHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
<p style="margin:24px 0 8px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#111111;color:#FBF8F3;padding:14px 22px;text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase">Ouvrir la commande</a></p>
<p style="margin:12px 0 0;color:#74706D;font-size:12px">Commande reçue, à confirmer par téléphone.</p>
</td></tr></table></td></tr></table></body></html>`;

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
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": config.brevoApiKey,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            sender: { name: "RASSM", email: config.from },
            to: [{ email: config.notifyEmail }],
            subject,
            htmlContent: html,
            textContent: text,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          const body = (await response.text().catch(() => "")).slice(0, 500);
          throw new Error(`Brevo answered ${response.status}: ${body}`);
        }
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
  };
}
