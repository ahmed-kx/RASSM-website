import {
  ADMIN_API_PATHS,
  ADMIN_SESSION_COOKIE,
  adminCookieName,
  adminSchema,
  type Admin,
} from "@rassm/shared";
import { cookies } from "next/headers";
import { z } from "zod";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** `__Host-rassm_admin` in production (https), `rassm_admin` in development. */
const SESSION_COOKIES = [
  adminCookieName(ADMIN_SESSION_COOKIE, true),
  adminCookieName(ADMIN_SESSION_COOKIE, false),
];

/**
 * The logged-in admin, checked with the API (server components only), or null when there
 * is no valid session. Never cached.
 */
export async function getAdminSession(): Promise<Admin | null> {
  const store = await cookies();
  const name = SESSION_COOKIES.find((cookie) => store.has(cookie));
  const token = name ? store.get(name)?.value : undefined;
  if (!name || !token) return null;
  try {
    const response = await fetch(`${API_URL}${ADMIN_API_PATHS.me}`, {
      headers: { Cookie: `${name}=${encodeURIComponent(token)}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const parsed = z.object({ admin: adminSchema }).safeParse(await response.json());
    return parsed.success ? parsed.data.admin : null;
  } catch {
    return null;
  }
}
