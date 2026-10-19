import { describe, expect, it } from "vitest";
import { describeUserAgent, formatReceivedAt, formatTableDate, initialOf } from "./format";

describe("admin formatting", () => {
  it("describes the customer's browser in short", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.71 Safari/537.36",
      ),
    ).toBe("Chrome 120.0 (Windows)");
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("Samsung Internet 24.0 (Android)");
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari 17.4 (iOS)");
    expect(describeUserAgent(null)).toBe("—");
    expect(describeUserAgent("curl/8.4.0")).toBe("Autre navigateur");
  });

  it("formats dates in Algeria time", () => {
    // 20:26 UTC = 21:26 in Algiers (UTC+1, no daylight saving time).
    expect(formatReceivedAt("2026-10-19T20:26:00.000Z")).toBe("Reçue le 19/10/2026 à 21:26");
    expect(formatTableDate("2026-10-19T20:26:00.000Z")).toEqual({ day: "19 oct.", time: "21:26" });
  });

  it("gives the avatar initial", () => {
    expect(initialOf(" karim")).toBe("K");
    expect(initialOf("Élise")).toBe("É");
  });
});
