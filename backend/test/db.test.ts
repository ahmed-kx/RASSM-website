import { describe, expect, it } from "vitest";
import { ensureSrvDns, type SrvResolver } from "../src/db";

const URI = "mongodb+srv://user:secret@cluster0.example.mongodb.net/?retryWrites=true";
const FALLBACK = ["1.1.1.1", "8.8.8.8"];

/** A resolver whose SRV answer depends on the DNS servers in use. */
function fakeResolver(answer: (servers: string[]) => "ok" | string) {
  let servers = ["127.0.0.1"];
  const lookups: string[] = [];
  const resolver: SrvResolver = {
    resolveSrv: async (name) => {
      lookups.push(name);
      const result = answer(servers);
      if (result !== "ok")
        throw Object.assign(new Error(`querySrv ${result} ${name}`), { code: result });
      return [{ name: "shard-00-00", port: 27017 }];
    },
    getServers: () => servers,
    setServers: (next) => {
      servers = [...next];
    },
  };
  return { resolver, lookups, servers: () => servers };
}

describe("ensureSrvDns (Atlas lookup behind a VPN)", () => {
  it("keeps the system DNS when it answers", async () => {
    const dns = fakeResolver(() => "ok");
    expect(await ensureSrvDns(URI, FALLBACK, dns.resolver)).toBe(false);
    expect(dns.lookups).toEqual(["_mongodb._tcp.cluster0.example.mongodb.net"]);
    expect(dns.servers()).toEqual(["127.0.0.1"]);
  });

  it("switches to the fallback servers when the system DNS refuses the lookup", async () => {
    const dns = fakeResolver((servers) => (servers.includes("127.0.0.1") ? "ECONNREFUSED" : "ok"));
    expect(await ensureSrvDns(URI, FALLBACK, dns.resolver)).toBe(true);
    expect(dns.servers()).toEqual(FALLBACK);
  });

  it("keeps the system DNS when the fallback fails too", async () => {
    const dns = fakeResolver(() => "ETIMEOUT");
    expect(await ensureSrvDns(URI, FALLBACK, dns.resolver)).toBe(false);
    expect(dns.servers()).toEqual(["127.0.0.1"]);
  });

  it("leaves a wrong host name to MongoDB, and ignores mongodb:// or no fallback", async () => {
    const notFound = fakeResolver(() => "ENOTFOUND");
    expect(await ensureSrvDns(URI, FALLBACK, notFound.resolver)).toBe(false);
    expect(notFound.servers()).toEqual(["127.0.0.1"]);

    const refused = fakeResolver(() => "ECONNREFUSED");
    expect(await ensureSrvDns("mongodb://127.0.0.1:27017/", FALLBACK, refused.resolver)).toBe(
      false,
    );
    expect(await ensureSrvDns(URI, [], refused.resolver)).toBe(false);
    expect(refused.lookups).toEqual([]);
  });
});
