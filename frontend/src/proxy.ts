import { ADMIN_SESSION_COOKIE } from "@rassm/shared";
import { NextResponse, type NextRequest } from "next/server";
import { adminCsp, cspOptionsFromEnv } from "@/lib/security-headers";

// Dashboard pages only.
// 1. Optimistic check: without a session cookie, /admin pages redirect to the login page. The
//    real check (is the session valid?) is done by the dashboard layout with the API, and
//    every admin API route checks the session again.
// 2. Strict Content-Security-Policy with a fresh nonce: Next.js puts it on its own scripts, so
//    any other script (an injected one) is refused by the browser.

const LOGIN_PATH = "/admin/connexion";
/** Pages open without a session: login and the password reset by e-mail. */
const PUBLIC_PATHS = [LOGIN_PATH, "/admin/mot-de-passe-oublie", "/admin/nouveau-mot-de-passe"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!PUBLIC_PATHS.includes(pathname) && !request.cookies.has(ADMIN_SESSION_COOKIE)) {
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
  matcher: ["/admin", "/admin/:path*"],
};
