import {
  ADMIN_API_PATHS,
  adminOrderListSchema,
  adminOrderSchema,
  adminOrderUpdatesSchema,
  adminSchema,
  apiErrorSchema,
  blacklistEntrySchema,
  bulkShipResultSchema,
  productSchema,
  type AdminLogin,
  type AdminOrderEdit,
  type AdminOrderQuery,
  type OrderStatus,
} from "@rassm/shared";
import { z } from "zod";
import { ApiError } from "@/lib/api";

// Dashboard data (browser). Calls /api/admin/* on the site's own domain (rewritten to the
// API by next.config.ts), with the httpOnly session cookie. Throws ApiError (French).

const GENERIC_ERROR = "Une erreur est survenue. Veuillez réessayer.";
const NETWORK_ERROR = "Connexion impossible. Vérifiez votre connexion internet et réessayez.";
/** The site answered but could not reach the API (Next.js proxy error, API stopped). */
export const UNREACHABLE_ERROR =
  "Le serveur est injoignable pour le moment. Veuillez réessayer dans un instant.";

/** Called on a 401 (session expired): the dashboard sends the admin back to the login page. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }
  if (response.ok) return response;
  if (response.status === 401 && onUnauthorized && !path.endsWith("/auth/login")) onUnauthorized();
  const body = apiErrorSchema.safeParse(await response.json().catch(() => null));
  if (body.success) {
    throw new ApiError(response.status, body.data.error.message, body.data.error.fields);
  }
  throw new ApiError(response.status, response.status >= 500 ? UNREACHABLE_ERROR : GENERIC_ERROR);
}

async function requestJson<T extends z.ZodType>(path: string, schema: T, init?: RequestInit) {
  const response = await request(path, init);
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new ApiError(response.status, GENERIC_ERROR);
  return parsed.data as z.output<T>;
}

const send = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

// ---------- Auth ----------

export function adminLogin(data: AdminLogin) {
  return requestJson(ADMIN_API_PATHS.login, z.object({ admin: adminSchema }), send("POST", data));
}

export async function adminLogout(): Promise<void> {
  await request(ADMIN_API_PATHS.logout, { method: "POST" }).catch(() => undefined);
}

// ---------- Orders ----------

const orderResponse = z.object({ order: adminOrderSchema });

export function fetchAdminOrders(query: AdminOrderQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return requestJson(`${ADMIN_API_PATHS.orders}?${params}`, adminOrderListSchema);
}

export function fetchOrderUpdates(since: string | null) {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return requestJson(`${ADMIN_API_PATHS.orderUpdates}${query}`, adminOrderUpdatesSchema);
}

export function fetchAdminOrder(id: string) {
  return requestJson(
    ADMIN_API_PATHS.order(id),
    z.object({ order: adminOrderSchema, product: productSchema.nullable() }),
  );
}

export async function changeOrderStatus(id: string, status: OrderStatus) {
  return (
    await requestJson(ADMIN_API_PATHS.orderStatus(id), orderResponse, send("POST", { status }))
  ).order;
}

export async function editAdminOrder(id: string, edit: AdminOrderEdit) {
  return (await requestJson(ADMIN_API_PATHS.order(id), orderResponse, send("PATCH", edit))).order;
}

export async function saveOrderNote(id: string, note: string) {
  return (await requestJson(ADMIN_API_PATHS.orderNote(id), orderResponse, send("PUT", { note })))
    .order;
}

export async function blacklistOrderPhone(id: string, reason: string) {
  return (
    await requestJson(ADMIN_API_PATHS.orderBlacklist(id), orderResponse, send("POST", { reason }))
  ).order;
}

/** Downloads the Anderson CSV; returns the ids of the exported orders. */
export async function exportForAnderson(selection: { ids: string[] } | { all: true }) {
  const response = await request(ADMIN_API_PATHS.andersonExport, send("POST", selection));
  const blob = await response.blob();
  const name =
    /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ??
    "anderson.csv";
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return (response.headers.get("X-Exported-Ids") ?? "").split(",").filter(Boolean);
}

export function shipOrders(ids: string[]) {
  return requestJson(ADMIN_API_PATHS.bulkShip, bulkShipResultSchema, send("POST", { ids }));
}

// ---------- Blacklist ----------

const blacklistResponse = z.object({ entries: z.array(blacklistEntrySchema) });

export async function fetchBlacklist() {
  return (await requestJson(ADMIN_API_PATHS.blacklist, blacklistResponse)).entries;
}

export async function addToBlacklist(phone: string, reason: string) {
  return (
    await requestJson(ADMIN_API_PATHS.blacklist, blacklistResponse, send("POST", { phone, reason }))
  ).entries;
}

export async function removeFromBlacklist(phone: string) {
  return (
    await requestJson(ADMIN_API_PATHS.blacklistEntry(phone), blacklistResponse, {
      method: "DELETE",
    })
  ).entries;
}
