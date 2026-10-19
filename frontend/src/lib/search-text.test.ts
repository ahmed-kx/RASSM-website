import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearchText } from "./search-text";

describe("wilaya search", () => {
  it("ignores accents, case, apostrophes and hyphens", () => {
    expect(normalizeSearchText("  Béjaïa ")).toBe("bejaia");
    expect(normalizeSearchText("M'Sila")).toBe("msila");
    expect(normalizeSearchText("Bordj Bou Arréridj")).toBe("bordj bou arreridj");
  });

  it("matches with or without accents", () => {
    expect(matchesSearch("Béjaïa", "bejaia")).toBe(true);
    expect(matchesSearch("Béjaïa", "BÉJAÏA")).toBe(true);
    expect(matchesSearch("Sétif", "set")).toBe(true);
    expect(matchesSearch("M'Sila", "m'sila")).toBe(true);
    expect(matchesSearch("Bordj Bou Arréridj", "bou arreridj")).toBe(true);
    expect(matchesSearch("Oran", "alger")).toBe(false);
  });

  it("an empty query matches everything", () => {
    expect(matchesSearch("Alger", "  ")).toBe(true);
  });
});
