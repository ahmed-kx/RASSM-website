import { describe, expect, it } from "vitest";
import { niceScale } from "./dashboard-charts";

describe("niceScale (Ventes Y axis)", () => {
  it("starts at 0 with round steps when nothing was sold", () => {
    expect(niceScale([0, 0, 0], false)).toEqual({
      domain: [0, 1000],
      ticks: [0, 250, 500, 750, 1000],
    });
    expect(niceScale([0, 0], true)).toEqual({ domain: [0, 4], ticks: [0, 1, 2, 3, 4] });
  });

  it("uses whole numbers for orders, even with a single order", () => {
    expect(niceScale([0, 1, 0], true)).toEqual({ domain: [0, 1], ticks: [0, 1] });
    expect(niceScale([0, 3, 7], true).ticks).toEqual([0, 2, 4, 6, 8]);
  });

  it("rounds amounts to 1, 2 or 5 × 10^n and always includes 0", () => {
    expect(niceScale([4200, 18_000], false)).toEqual({
      domain: [0, 20_000],
      ticks: [0, 5000, 10_000, 15_000, 20_000],
    });
    expect(niceScale([7900], false).domain).toEqual([0, 8000]);
  });

  it("keeps 0 and extends below it for a negative profit", () => {
    const { domain, ticks } = niceScale([-1200, 3000], false);
    expect(domain[0]).toBeLessThan(0);
    expect(ticks).toContain(0);
  });
});
