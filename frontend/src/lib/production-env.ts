// Production checks of the website's environment, run by next.config.ts (so `next build` and
// `next start` stop with a clear list). Same rule as the API: an https site is a deployed site,
// and a deployed site must not run with a missing or weak secret. Full list of the variables:
// docs/ENV-PRODUCTION.md.

type Env = Record<string, string | undefined>;

const isLocal = (url: URL) => ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(url.hostname);

function parseUrl(value: string | undefined): URL | null {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

const isPublicHttps = (value: string | undefined) => {
  const url = parseUrl(value);
  return url !== null && url.protocol === "https:" && !isLocal(url);
};

/** Too short, or too few different characters ("aaaa…", "abcabc…"). */
const weakSecret = (value: string | undefined, minLength: number) =>
  !value || value.length < minLength || new Set(value).size < 10;

/** True when NEXT_PUBLIC_SITE_URL is a public https site (a deployment). */
export const isDeployedSite = (env: Env) => isPublicHttps(env.NEXT_PUBLIC_SITE_URL);

/** What is wrong for a deployed site, one line per variable (empty = ready, or not deployed). */
export function productionEnvProblems(env: Env): string[] {
  if (!isDeployedSite(env)) return [];
  const problems: string[] = [];
  if (!isPublicHttps(env.NEXT_PUBLIC_API_URL)) {
    problems.push(
      "NEXT_PUBLIC_API_URL must be the https:// API, e.g. https://api.rassmstore.live.",
    );
  }
  if (env.API_URL && !isPublicHttps(env.API_URL)) {
    problems.push("API_URL must be an https:// URL (or empty).");
  }
  if (weakSecret(env.ADMIN_PROXY_SECRET, 32)) {
    problems.push(
      "ADMIN_PROXY_SECRET must be set to 32+ random characters (the same value as in the API).",
    );
  }
  if (!/^(10|[0-9])$/.test(env.TRUST_PROXY?.trim() ?? "")) {
    problems.push(
      "TRUST_PROXY must be set: the number of proxies in front of the site (Vercel: 1).",
    );
  }
  if (weakSecret(env.REVALIDATE_SECRET, 32)) {
    problems.push(
      "REVALIDATE_SECRET must be set to 32+ random characters (the same value as in the API).",
    );
  }
  const adminHost = env.ADMIN_HOST?.trim();
  if (adminHost && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(adminHost)) {
    problems.push("ADMIN_HOST must be a host name only, e.g. admin.rassmstore.live (no https://).");
  }
  return problems;
}
