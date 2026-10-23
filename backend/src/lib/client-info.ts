import type { Request } from "express";
import { clientIpOf } from "./client-ip";

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
  /** Approximate location ("Alger, Algérie") when the host adds it, else null. */
  location: string | null;
}

/**
 * Client IP and user agent. The IP comes from `clientIpOf` (lib/client-ip.ts): X-Forwarded-For
 * only for the TRUST_PROXY proxies, and on the dashboard the IP signed by the website.
 */
export function getClientInfo(req: Request): ClientInfo {
  const ip = clientIpOf(req);
  const userAgent = req.get("user-agent")?.slice(0, 500) ?? null;
  return { ip: ip || null, userAgent: userAgent || null, location: readLocation(req, ip) };
}

const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });

const header = (req: Request, name: string) => {
  const value = req.get(name)?.trim();
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, 80);
  } catch {
    return value.slice(0, 80);
  }
};

/**
 * Approximate location from the geolocation headers of the host (Cloudflare, Vercel), when
 * there are some. No IP is sent to a third-party service. Only shown to the admin (Sécurité,
 * alerts), never used to allow or refuse anything.
 */
function readLocation(req: Request, ip: string | null): string | null {
  const city = header(req, "cf-ipcity") ?? header(req, "x-vercel-ip-city");
  const country = header(req, "cf-ipcountry") ?? header(req, "x-vercel-ip-country");
  let countryName: string | null = null;
  if (country && /^[A-Z]{2}$/i.test(country) && !/^(XX|T1)$/i.test(country)) {
    try {
      countryName = countryNames.of(country.toUpperCase()) ?? null;
    } catch {
      countryName = null;
    }
  }
  const parts = [city, countryName].filter(Boolean);
  if (parts.length) return parts.join(", ");
  if (ip && isPrivateIp(ip)) return "Réseau local";
  return null;
}

export function isPrivateIp(ip: string): boolean {
  return (
    ip === "::1" ||
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe80:/i.test(ip)
  );
}
