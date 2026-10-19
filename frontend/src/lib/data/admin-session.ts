import { ADMIN_API_PATHS, ADMIN_SESSION_COOKIE, adminSchema, type Admin } from "@rassm/shared";
import { cookies } from "next/headers";
import { z } from "zod";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * The logged-in admin, checked with the API (server components only), or null when there
 * is no valid session. Never cached.
 */
export async function getAdminSession(): Promise<Admin | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${API_URL}${ADMIN_API_PATHS.me}`, {
      headers: { Cookie: `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const parsed = z.object({ admin: adminSchema }).safeParse(await response.json());
    return parsed.success ? parsed.data.admin : null;
  } catch {
    return null;
  }
}
