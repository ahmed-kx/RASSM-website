import { ADMIN_SESSION_COOKIE } from "@rassm/shared";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check for the dashboard: without a session cookie, /admin pages redirect to
// the login page. The real check (is the session valid?) is done by the dashboard layout
// with the API, and every admin API route checks the session again.

const LOGIN_PATH = "/admin/connexion";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === LOGIN_PATH || request.cookies.has(ADMIN_SESSION_COOKIE)) {
    return NextResponse.next();
  }
  const login = new URL(LOGIN_PATH, request.url);
  login.searchParams.set("suivant", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
