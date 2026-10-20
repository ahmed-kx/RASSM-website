// CSV files opened directly by Excel (UTF-8 with BOM, ";" separator as in French Excel).

/** "0555123456" → "0555 12 34 56": with spaces Excel keeps the leading 0 (text, not a number). */
export const formatPhoneForCsv = (phone: string) =>
  phone.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4");

/** Quotes a value; a leading = + - @ is neutralised so Excel never runs it as a formula. */
export function csvCell(value: string | number): string {
  let text = String(value).replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(
  columns: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const lines = [columns, ...rows].map((row) => row.map(csvCell).join(";"));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** "clients-2026-10-19.csv" (Algiers date). */
export function csvFileName(prefix: string, now = new Date()): string {
  const date = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
  return `${prefix}-${date}.csv`;
}
