import {
  ADMIN_SESSION_COOKIE,
  CLIENT_IP_HEADER,
  CLIENT_IP_SIGNATURE_HEADER,
  adminCookieName,
  signClientIp,
} from "@rassm/shared";
import { NextResponse, type NextRequest } from "next/server";
import { trustedProxiesFromEnv, visitorIp } from "@/lib/client-ip";
import { adminCsp, cspOptionsFromEnv } from "@/lib/security-headers";

// Dashboard pages and dashboard API calls only.
// 1. /api/admin/*: forwarded to the API (API_URL, else NEXT_PUBLIC_API_URL) from this site's own
//    domain, so the session cookie is a first-party cookie of the dashboard. The visitor's IP is
//    sent in a header signed with ADMIN_PROXY_SECRET (headers of that name sent by the visitor
//    are replaced; the API never reads X-Forwarded-For there). With the dashboard on its own
//    subdomain (ADMIN_HOST), this API only exists on that host: 404 on the public site.
// 2. Optimistic check: without a session cookie, /admin pages redirect to the login page. The
//    real check (is the session valid?) is done by the dashboard layout with the API, and every
//    admin API route checks the session again.
// 3. Strict Content-Security-Policy with a fresh nonce: Next.js puts it on its own scripts, so
//    any other script (an injected one) is refused by the browser.

const LOGIN_PATH = "/admin/connexion";
/** Pages open without a session: login and the password reset by e-mail. */
const PUBLIC_PATHS = [LOGIN_PATH, "/admin/mot-de-passe-oublie", "/admin/nouveau-mot-de-passe"];
/** `__Host-rassm_admin` in production (https), `rassm_admin` in development. */
const SESSION_COOKIES = [
  adminCookieName(ADMIN_SESSION_COOKIE, true),
  adminCookieName(ADMIN_SESSION_COOKIE, false),
];

let warnedNoSecret = false;

/** The host of a request, lowercase, without the port. */
const hostOf = (request: NextRequest) =>
  (request.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();

async function forwardToApi(request: NextRequest) {
  const adminHost = process.env.ADMIN_HOST?.trim().toLowerCase();
  if (adminHost && hostOf(request) !== adminHost) return new NextResponse(null, { status: 404 });

  const headers = new Headers(request.headers);
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(CLIENT_IP_SIGNATURE_HEADER);
  const secret = process.env.ADMIN_PROXY_SECRET;
  const ip = visitorIp(request.headers.get("x-forwarded-for"), trustedProxiesFromEnv());
  if (secret && ip) {
    headers.set(CLIENT_IP_HEADER, ip);
    headers.set(CLIENT_IP_SIGNATURE_HEADER, await signClientIp(secret, ip, Date.now()));
  } else if (!secret && process.env.NODE_ENV === "production" && !warnedNoSecret) {
    warnedNoSecret = true;
    console.warn(
      "ADMIN_PROXY_SECRET is not set: the API cannot know the IP of dashboard visitors (set the same value in the website and the API).",
    );
  }
  const api = (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
  const { pathname, search } = request.nextUrl;
  return NextResponse.rewrite(new URL(`${api}${pathname}${search}`), { request: { headers } });
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/admin/")) return forwardToApi(request);

  const loggedIn = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!PUBLIC_PATHS.includes(pathname) && !loggedIn) {
    const login = new URL(LOGIN_PATH, request.url);
    login.searchParams.set("suivant", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = adminCsp({ ...cspOptionsFromEnv(), nonce });
  // Next.js reads the nonce from the request's policy while rendering.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
