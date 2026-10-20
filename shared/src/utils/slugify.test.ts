import { describe, expect, it } from "vitest";
import { slugSchema } from "../schemas/common";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("makes a valid slug from a French product name", () => {
    expect(slugify("Écho Sweatshirt (copie)")).toBe("echo-sweatshirt-copie");
    expect(slugify("  T-shirt   « Silence »  ")).toBe("t-shirt-silence");
    expect(slugSchema.safeParse(slugify("Hoodie Noir & Crème")).success).toBe(true);
    expect(slugify("!!!")).toBe("");
  });
});
