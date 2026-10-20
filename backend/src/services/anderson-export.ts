import { formatWilaya, getWilaya } from "@rassm/shared";
import { buildCsv, csvFileName, formatPhoneForCsv } from "../lib/csv";
import type { OrderDoc } from "../models/order";

// Courier file for Anderson: one line per confirmed order, opened directly by Excel.

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

/** One line. The product description starts with its SKU when known ("RSM-H-001 Signature Hoodie…"). */
export function andersonRow(order: ExportOrder, sku?: string): (string | number)[] {
  const wilaya = getWilaya(order.wilayaCode);
  return [
    order.orderNumber,
    order.fullName,
    formatPhoneForCsv(order.phone),
    wilaya ? formatWilaya(wilaya) : order.wilayaCode,
    order.commune,
    order.deliveryType === "home" ? order.address : "Stop desk (bureau Anderson)",
    order.deliveryType === "home" ? "Domicile" : "Stop desk",
    `${sku ? `${sku} ` : ""}${order.item.name} - ${order.item.color} - Taille ${order.item.size} - x${order.item.quantity}`,
    order.total,
  ];
}

export function buildAndersonCsv(
  orders: readonly ExportOrder[],
  skus: ReadonlyMap<string, string> = new Map(),
): string {
  return buildCsv(
    ANDERSON_COLUMNS,
    orders.map((order) => andersonRow(order, skus.get(order.item.productId))),
  );
}

/** anderson-2026-10-19.csv (Algiers date). */
export function andersonFileName(now = new Date()): string {
  return csvFileName("anderson", now);
}
