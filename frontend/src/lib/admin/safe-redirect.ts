// The page to open after login (?suivant=…): only a dashboard path of this site, never another
// site (open redirect) or a "javascript:" link, whatever is written in the address bar.

const BASE = "https://rassm.invalid";

export function safeAdminPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  try {
    // Parsed like the browser would (tabs and new lines removed, "/../" resolved).
    const url = new URL(next, BASE);
    if (url.origin !== BASE || !/^\/admin(\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
