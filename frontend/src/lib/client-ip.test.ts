import { describe, expect, it } from "vitest";
import { visitorIp } from "./client-ip";

describe("visitorIp (dashboard requests forwarded to the API)", () => {
  it("takes the address added by the host's proxies, never what the visitor wrote", () => {
    // The visitor sent "1.2.3.4"; one proxy in front of the site added the real address.
    expect(visitorIp("1.2.3.4, 41.200.10.20", 1)).toBe("41.200.10.20");
    // Two proxies (CDN + load balancer): the visitor is the second entry from the end.
    expect(visitorIp("1.2.3.4, 41.200.10.20, 10.0.0.5", 2)).toBe("41.200.10.20");
    // No proxy (development): the address Next.js saw.
    expect(visitorIp("::ffff:127.0.0.1", 0)).toBe("127.0.0.1");
  });

  it("returns null without a usable address", () => {
    expect(visitorIp(null, 1)).toBeNull();
    expect(visitorIp("", 1)).toBeNull();
    expect(visitorIp("pas-une-ip", 1)).toBeNull();
  });
});
