import { describe, expect, it } from "vitest";
import { isDeployedSite, productionEnvProblems } from "./production-env";

const READY = {
  NEXT_PUBLIC_SITE_URL: "https://rassmstore.live",
  NEXT_PUBLIC_API_URL: "https://api.rassmstore.live",
  ADMIN_PROXY_SECRET: "q7Vd-2mXk9_LpA3sTz8RwYc4NbHe6JfU",
  TRUST_PROXY: "1",
  REVALIDATE_SECRET: "Zr4Ty8Qp2Lm6Xs0Vb3Nc7Hd1Kf5Gj9Wa",
  ADMIN_HOST: "admin.rassmstore.live",
};

describe("productionEnvProblems", () => {
  it("checks nothing on a local site", () => {
    expect(isDeployedSite({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe(false);
    expect(productionEnvProblems({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toEqual([]);
    expect(productionEnvProblems({})).toEqual([]);
  });

  it("accepts a complete production environment", () => {
    expect(productionEnvProblems(READY)).toEqual([]);
    expect(productionEnvProblems({ ...READY, ADMIN_HOST: "" })).toEqual([]);
  });

  it("lists every missing or weak variable of an https site", () => {
    const problems = productionEnvProblems({
      NEXT_PUBLIC_SITE_URL: "https://rassmstore.live",
      NEXT_PUBLIC_API_URL: "http://localhost:4000",
      ADMIN_PROXY_SECRET: "short",
    });
    expect(problems.join("\n")).toMatch(/NEXT_PUBLIC_API_URL/);
    expect(problems.join("\n")).toMatch(/ADMIN_PROXY_SECRET/);
    expect(problems.join("\n")).toMatch(/TRUST_PROXY/);
    expect(problems.join("\n")).toMatch(/REVALIDATE_SECRET/);
  });

  it("refuses repetitive secrets, a wrong TRUST_PROXY and a URL in ADMIN_HOST", () => {
    const problems = productionEnvProblems({
      ...READY,
      ADMIN_PROXY_SECRET: "a".repeat(40),
      TRUST_PROXY: "yes",
      ADMIN_HOST: "https://admin.rassmstore.live",
      API_URL: "http://10.0.0.5:4000",
    });
    expect(problems).toHaveLength(4);
  });
});
