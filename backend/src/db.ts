import dns from "node:dns";
import mongoose from "mongoose";
import { logger } from "./lib/logger";

// Unknown fields in query filters are dropped instead of being sent to MongoDB.
mongoose.set("strictQuery", true);

export interface ConnectOptions {
  /** DNS servers for Node's own lookups when the system ones refuse the Atlas SRV lookup. */
  dnsFallbackServers?: readonly string[];
}

export async function connectDatabase(
  uri: string,
  dbName: string,
  { dnsFallbackServers = [] }: ConnectOptions = {},
): Promise<typeof mongoose> {
  await ensureSrvDns(uri, dnsFallbackServers);
  return mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10_000 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

/** The parts of node:dns used for the SRV check (replaced in tests). */
export interface SrvResolver {
  resolveSrv: (name: string) => Promise<unknown>;
  getServers: () => string[];
  setServers: (servers: readonly string[]) => void;
}

const nodeResolver: SrvResolver = {
  resolveSrv: (name) => dns.promises.resolveSrv(name),
  getServers: () => dns.getServers(),
  setServers: (servers) => dns.setServers(servers),
};

/** The DNS server did not answer (as opposed to "this name does not exist"). */
const DNS_SERVER_FAILURES = new Set([
  "ECONNREFUSED",
  "ETIMEOUT",
  "ECONNRESET",
  "ESERVFAIL",
  "EREFUSED",
]);

/**
 * A mongodb+srv:// URI needs an SRV lookup, which Node makes with its own resolver, not the
 * Windows one. VPN software can leave that resolver on a DNS server that refuses queries
 * (e.g. 127.0.0.1): the lookup fails ("querySrv ECONNREFUSED") although the network works.
 * In that case Node's lookups switch to the fallback servers. Returns true when it switched.
 */
export async function ensureSrvDns(
  uri: string,
  fallbackServers: readonly string[],
  resolver: SrvResolver = nodeResolver,
): Promise<boolean> {
  if (!uri.startsWith("mongodb+srv://") || fallbackServers.length === 0) return false;
  let srvName: string;
  try {
    srvName = `_mongodb._tcp.${new URL(uri).hostname}`;
  } catch {
    return false; // MongoDB reports the invalid URI itself
  }

  try {
    await resolver.resolveSrv(srvName);
    return false;
  } catch (error) {
    // A wrong host name (ENOTFOUND) is reported by MongoDB as usual.
    if (!DNS_SERVER_FAILURES.has((error as { code?: string }).code ?? "")) return false;
  }

  const systemServers = resolver.getServers();
  resolver.setServers(fallbackServers);
  try {
    await resolver.resolveSrv(srvName);
  } catch {
    resolver.setServers(systemServers);
    return false;
  }
  logger.warn("The system DNS refused the MongoDB SRV lookup: using the fallback DNS servers", {
    systemServers,
    fallbackServers,
  });
  return true;
}
