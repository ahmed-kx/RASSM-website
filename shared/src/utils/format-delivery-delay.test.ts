import { describe, expect, it } from "vitest";
import { formatDeliveryDelay } from "./format-delivery-delay";

describe("formatDeliveryDelay", () => {
  it("writes the delay in French, singular for one day", () => {
    expect(formatDeliveryDelay(1)).toBe("1 jour");
    expect(formatDeliveryDelay(3)).toBe("3 jours");
  });
});
