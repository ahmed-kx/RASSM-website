import { describe, expect, it } from "vitest";
import { formatPrice } from "./format-price";

describe("formatPrice", () => {
  it("uses a narrow no-break space for thousands and puts DA after the number", () => {
    expect(formatPrice(7900)).toBe("7 900 DA");
    expect(formatPrice(1250000)).toBe("1 250 000 DA");
  });

  it("does not group numbers below 1000", () => {
    expect(formatPrice(0)).toBe("0 DA");
    expect(formatPrice(400)).toBe("400 DA");
  });

  it("rounds and handles negative amounts", () => {
    expect(formatPrice(99.6)).toBe("100 DA");
    expect(formatPrice(-1500)).toBe("−1 500 DA");
  });
});
