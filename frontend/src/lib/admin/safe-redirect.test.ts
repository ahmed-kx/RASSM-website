import { describe, expect, it } from "vitest";
import { safeAdminPath } from "./safe-redirect";

const HOME = "/admin/commandes";

describe("safeAdminPath", () => {
  it("keeps dashboard paths with their query", () => {
    expect(safeAdminPath("/admin", HOME)).toBe("/admin");
    expect(safeAdminPath("/admin/commandes?statut=pending&page=2", HOME)).toBe(
      "/admin/commandes?statut=pending&page=2",
    );
    expect(safeAdminPath("/admin/produits/prod_001#stock", HOME)).toBe(
      "/admin/produits/prod_001#stock",
    );
  });

  it("refuses other sites, other pages and tricks (open redirect)", () => {
    for (const next of [
      null,
      "",
      "https://evil.example/admin",
      "//evil.example/admin",
      "/\t/evil.example/admin",
      "/admin\\..\\..\\evil",
      "/\\evil.example",
      "javascript:alert(1)",
      "/collection",
      "/administrateur",
      "/admin/../collection",
      "/admin/%2e%2e/%2e%2e/collection",
    ]) {
      expect(safeAdminPath(next, HOME), String(next)).toBe(HOME);
    }
  });
});
