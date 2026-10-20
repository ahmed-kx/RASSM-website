/**
 * Estimated delivery time in French: "1 jour", "3 jours".
 * The fee data gives one number of days per wilaya (Anderson's estimate from Alger).
 */
export function formatDeliveryDelay(days: number): string {
  return `${days} jour${days > 1 ? "s" : ""}`;
}

/** Dashboard delay column: "24 h" for next day, else "Jusqu'à 5 jours". */
export function formatDeliveryWindow(days: number): string {
  return days <= 1 ? "24 h" : `Jusqu'à ${days} jours`;
}
