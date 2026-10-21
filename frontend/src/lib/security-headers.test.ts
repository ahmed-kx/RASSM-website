import { describe, expect, it } from "vitest";
import { adminCsp, publicCsp, securityHeaders } from "./security-headers";

const prod = { apiOrigin: "https://api.rassm.dz", dev: false, https: true };
const directive = (policy: string, name: string) =>
  policy.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

describe("Content-Security-Policy", () => {
  it("public site: our scripts and Meta only, the API and Meta for requests, no framing", () => {
    const policy = publicCsp(prod);
    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
    );
    expect(directive(policy, "connect-src")).toBe(
      "connect-src 'self' https://api.rassm.dz https://www.facebook.com https://connect.facebook.net",
    );
    expect(directive(policy, "img-src")).toContain("https://res.cloudinary.com");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toMatch(/upgrade-insecure-requests$/);
    expect(policy).not.toContain("unsafe-eval");
  });

  it("dashboard: nonce + strict-dynamic, no inline script, no third party", () => {
    const policy = adminCsp({ ...prod, nonce: "abc123==" });
    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'nonce-abc123==' 'strict-dynamic'",
    );
    expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
    expect(policy).not.toContain("facebook");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("development: eval for React's overlay, no https upgrade", () => {
    const dev = { apiOrigin: "http://localhost:4000", dev: true, https: false };
    expect(directive(publicCsp(dev), "script-src")).toContain("'unsafe-eval'");
    expect(publicCsp(dev)).not.toContain("upgrade-insecure-requests");
  });
});

describe("securityHeaders", () => {
  it("sends HSTS only on https", () => {
    const keys = (https: boolean) => securityHeaders({ https }).map((header) => header.key);
    expect(keys(true)).toContain("Strict-Transport-Security");
    expect(keys(false)).not.toContain("Strict-Transport-Security");
    expect(keys(false)).toEqual(
      expect.arrayContaining([
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });
});
