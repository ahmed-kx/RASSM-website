import type { Request } from "express";

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

/**
 * Client IP and user agent. The IP comes from `req.ip`, which reads X-Forwarded-For only
 * for the number of proxies set in TRUST_PROXY (so it cannot be spoofed by the client).
 */
export function getClientInfo(req: Request): ClientInfo {
  const ip = req.ip?.replace(/^::ffff:/, "") ?? null;
  const userAgent = req.get("user-agent")?.slice(0, 500) ?? null;
  return { ip: ip || null, userAgent: userAgent || null };
}
