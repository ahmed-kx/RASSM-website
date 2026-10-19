const THIN_NBSP = " ";
const NBSP = " ";

/**
 * Formats a DA amount in the French format used in Algeria: `formatPrice(7900)` → "7 900 DA".
 * A narrow no-break space separates thousands, a no-break space precedes "DA", so a price never
 * wraps. Deliberately avoids Intl so server and client always render the same string.
 */
export function formatPrice(amount: number): string {
  const rounded = Math.round(amount);
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, THIN_NBSP);
  return `${rounded < 0 ? "−" : ""}${digits}${NBSP}DA`;
}
