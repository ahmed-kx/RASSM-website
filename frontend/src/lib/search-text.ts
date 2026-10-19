/**
 * Lowercase text without accents, apostrophes or hyphens, so that "bejaia" finds
 * "Béjaïa" and "msila" finds "M'Sila".
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when every word of the query appears in the text (accent-insensitive). */
export function matchesSearch(text: string, query: string): boolean {
  const words = normalizeSearchText(query).split(" ").filter(Boolean);
  const haystack = normalizeSearchText(text);
  return words.every((word) => haystack.includes(word));
}
