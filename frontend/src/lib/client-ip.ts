// The visitor's IP as seen by the website, for the dashboard requests it forwards to the API.
//
// Next.js keeps an X-Forwarded-For header sent by the visitor as it is (it only adds one when
// there is none), so its first entries can be anything. The hosting proxies in front of the site
// add the address they saw at the end: with TRUST_PROXY proxies, the visitor is the
// TRUST_PROXY-th entry from the end. With 0 (development, no proxy) the last entry is used.

export function visitorIp(forwardedFor: string | null, trustedProxies: number): string | null {
  const hops = (forwardedFor ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (hops.length === 0) return null;
  const index = Math.max(0, hops.length - Math.max(1, trustedProxies));
  const ip = hops[index]?.replace(/^::ffff:/, "") ?? null;
  return ip && /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : null;
}

/** TRUST_PROXY of the website (number of proxies in front of it), 0 when not set. */
export function trustedProxiesFromEnv(): number {
  const value = Number(process.env.TRUST_PROXY ?? 0);
  return Number.isInteger(value) && value >= 0 && value <= 10 ? value : 0;
}
