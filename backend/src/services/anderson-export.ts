import { formatWilaya, getWilaya } from "@rassm/shared";
import type { OrderDoc } from "../models/order";

// Courier file for Anderson: one line per confirmed order, opened directly by Excel
// (UTF-8 with BOM, ";" separator as in French Excel).

export const ANDERSON_COLUMNS = [
  "Référence",
  "Nom",
  "Téléphone",
  "Wilaya",
  "Commune",
  "Adresse",
  "Type de livraison",
  "Produit",
  "Montant à encaisser (DA)",
] as const;

/** "0555123456" → "0555 12 34 56": with spaces Excel keeps the leading 0 (text, not a number). */
const formatPhone = (phone: string) =>
  phone.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4");

/** Quotes a value; a leading = + - @ is neutralised so Excel never runs it as a formula. */
function csvCell(value: string | number): string {
  let text = String(value).replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export type ExportOrder = Pick<
  OrderDoc,
  | "orderNumber"
  | "fullName"
  | "phone"
  | "wilayaCode"
  | "commune"
  | "address"
  | "deliveryType"
  | "item"
  | "total"
>;

export function andersonRow(order: ExportOrder): (string | number)[] {
  const wilaya = getWilaya(order.wilayaCode);
  return [
    order.orderNumber,
    order.fullName,
    formatPhone(order.phone),
    wilaya ? formatWilaya(wilaya) : order.wilayaCode,
    order.commune,
    order.deliveryType === "home" ? order.address : "Stop desk (bureau Anderson)",
    order.deliveryType === "home" ? "Domicile" : "Stop desk",
    `${order.item.name} - ${order.item.color} - Taille ${order.item.size} - x${order.item.quantity}`,
    order.total,
  ];
}

export function buildAndersonCsv(orders: readonly ExportOrder[]): string {
  const lines = [ANDERSON_COLUMNS, ...orders.map(andersonRow)].map((row) =>
    row.map(csvCell).join(";"),
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** anderson-2026-10-19.csv (Algiers date). */
export function andersonFileName(now = new Date()): string {
  const date = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
  return `anderson-${date}.csv`;
}
