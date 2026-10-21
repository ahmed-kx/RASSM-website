import { describe, expect, it } from "vitest";
import { formTimingReason, newsletterRequestSchema, orderRequestSchema } from "./api";
import { algerianPhoneSchema, normalizeAlgerianPhone } from "./customer";

describe("normalizeAlgerianPhone", () => {
  it("writes every form of the same number the same way", () => {
    for (const phone of [
      "0555123456",
      "0555 12 34 56",
      "0555-12-34-56",
      "0555.12.34.56",
      "(0555) 12 34 56",
      "+213555123456",
      "+213 555 12 34 56",
      "+213 (0) 555 12 34 56",
      "00213555123456",
      "00 213 555 12 34 56",
      "213555123456",
      "\u0660\u0665\u0665\u0665\u0661\u0662\u0663\u0664\u0665\u0666",
      "0555\u00a012\u202f34 56",
    ]) {
      expect(normalizeAlgerianPhone(phone), phone).toBe("0555123456");
    }
  });

  it("leaves other numbers as typed, so the schema refuses them", () => {
    expect(normalizeAlgerianPhone("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(algerianPhoneSchema.safeParse("+33 6 12 34 56 78").success).toBe(false);
    expect(algerianPhoneSchema.safeParse("+213 255 12 34 56").success).toBe(false);
    expect(algerianPhoneSchema.parse("+213 770 11 22 33")).toBe("0770112233");
  });
});

describe("formTimingReason", () => {
  it("flags sends faster than 2 seconds, or without the form", () => {
    expect(formTimingReason(undefined)).toBe(
      "Envoyé sans passer par le formulaire du site (robot probable)",
    );
    expect(formTimingReason(0)).toBe("Formulaire envoyé en 0 s (robot probable)");
    expect(formTimingReason(1450)).toBe("Formulaire envoyé en 1,5 s (robot probable)");
    expect(formTimingReason(2000)).toBeNull();
    expect(formTimingReason(45_000)).toBeNull();
  });

  it("never refuses a request because of a strange value (it is only flagged)", () => {
    const order = orderRequestSchema.shape.elapsedMs;
    expect(order.parse("vite")).toBeUndefined();
    expect(order.parse(-5)).toBeUndefined();
    expect(order.parse(3200.7)).toBeUndefined();
    expect(newsletterRequestSchema.parse({ email: "a@b.dz", elapsedMs: 5000 })).toEqual({
      email: "a@b.dz",
      elapsedMs: 5000,
    });
  });
});
