import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The ad click id (?fbclid=) kept in the _fbc cookie, and the data sent with an order.

/** A browser stand-in: an address bar and a cookie jar that understands Max-Age. */
function fakeBrowser() {
  const jar = new Map<string, string>();
  const written: string[] = [];
  const location = new URL("http://localhost:3000/");
  vi.stubGlobal("window", { location });
  vi.stubGlobal("document", {
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(line: string) {
      written.push(line);
      const [pair = ""] = line.split(";");
      const [name = "", ...value] = pair.split("=");
      jar.set(name.trim(), value.join("="));
    },
  });
  return {
    jar,
    written,
    visit(path: string) {
      const next = new URL(path, "http://localhost:3000");
      location.href = next.href;
    },
  };
}

async function loadPixel(pixelId = "") {
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", pixelId);
  vi.resetModules();
  return import("./meta-pixel");
}

let browser: ReturnType<typeof fakeBrowser>;
beforeEach(() => {
  browser = fakeBrowser();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("captureAdClick", () => {
  it("keeps ?fbclid= in the _fbc cookie for 90 days, in Meta's format", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-23T10:00:00Z") });
    const { captureAdClick } = await loadPixel();
    browser.visit("/?fbclid=test123&utm_source=facebook");
    captureAdClick();
    expect(browser.jar.get("_fbc")).toBe(`fb.1.${Date.parse("2026-10-23T10:00:00Z")}.test123`);
    expect(browser.written[0]).toMatch(/Max-Age=7776000; Path=\/; SameSite=Lax/);
  });

  it("keeps the click while the visitor browses, and orders from another page", async () => {
    const { captureAdClick, getMetaTracking } = await loadPixel();
    browser.visit("/?fbclid=test123");
    captureAdClick();
    const fbc = browser.jar.get("_fbc");
    for (const path of ["/collection", "/collection/unspoken-tee"]) {
      browser.visit(path);
      captureAdClick();
    }
    expect(browser.jar.get("_fbc")).toBe(fbc);
    expect(getMetaTracking()).toMatchObject({
      fbc,
      eventSourceUrl: "http://localhost:3000/collection/unspoken-tee",
    });
  });

  it("never rewrites the Pixel's own cookie for the same click, but follows a new ad click", async () => {
    const { captureAdClick } = await loadPixel();
    browser.jar.set("_fbc", "fb.1.1700000000000.test123");
    browser.visit("/collection?fbclid=test123");
    captureAdClick();
    expect(browser.written).toHaveLength(0);

    browser.visit("/?fbclid=nouveau456");
    captureAdClick();
    expect(browser.jar.get("_fbc")).toMatch(/^fb\.1\.\d{13}\.nouveau456$/);
  });

  it("does nothing without an ad click", async () => {
    const { captureAdClick, getMetaTracking } = await loadPixel();
    browser.visit("/collection");
    captureAdClick();
    expect(browser.written).toHaveLength(0);
    expect(getMetaTracking()).toEqual({ eventSourceUrl: "http://localhost:3000/collection" });
  });
});

describe("getMetaTracking (sent with the order)", () => {
  it("sends the Pixel's _fbp and the click's _fbc", async () => {
    const { getMetaTracking } = await loadPixel("1234567890");
    browser.jar.set("_fbp", "fb.1.1700000000000.1234567890");
    browser.visit("/collection/unspoken-tee?fbclid=test123");
    expect(getMetaTracking()).toEqual({
      fbp: "fb.1.1700000000000.1234567890",
      fbc: expect.stringMatching(/^fb\.1\.\d{13}\.test123$/),
      eventSourceUrl: "http://localhost:3000/collection/unspoken-tee?fbclid=test123",
    });
  });

  it("creates _fbp in Meta's format when a blocker stopped the Pixel from writing it", async () => {
    const { getMetaTracking } = await loadPixel("1234567890");
    const tracking = getMetaTracking();
    expect(tracking.fbp).toMatch(/^fb\.1\.\d{13}\.\d{10}$/);
    expect(browser.jar.get("_fbp")).toBe(tracking.fbp);
    // The same one the next time (no new browser id per order).
    expect(getMetaTracking().fbp).toBe(tracking.fbp);
  });

  it("creates no _fbp when the Pixel is off", async () => {
    const { getMetaTracking } = await loadPixel("");
    expect(getMetaTracking().fbp).toBeUndefined();
  });
});
