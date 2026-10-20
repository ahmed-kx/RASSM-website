import { ADMIN_SESSION_COOKIE } from "@rassm/shared";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check for the dashboard: without a session cookie, /admin pages redirect to
// the login page. The real check (is the session valid?) is done by the dashboard layout
// with the API, and every admin API route checks the session again.

const LOGIN_PATH = "/admin/connexion";
/** Pages open without a session: login and the password reset by e-mail. */
const PUBLIC_PATHS = [LOGIN_PATH, "/admin/mot-de-passe-oublie", "/admin/nouveau-mot-de-passe"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname) || request.cookies.has(ADMIN_SESSION_COOKIE)) {
    return NextResponse.next();
  }
  const login = new URL(LOGIN_PATH, request.url);
  login.searchParams.set("suivant", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
