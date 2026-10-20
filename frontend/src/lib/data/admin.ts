import {
  ADMIN_API_PATHS,
  adSpendSchema,
  adminClientDetailSchema,
  adminClientListSchema,
  adminMessageListSchema,
  adminMessageSchema,
  adminSubscriberListSchema,
  adminSubscriberSchema,
  adsPageSchema,
  dashboardStatsSchema,
  type AdSpendInput,
  type AdminClientQuery,
  type AdminMessageQuery,
  type AdminMessageUpdate,
  type AdminSettingsUpdate,
  type AdminSubscriberQuery,
  type StatsQuery,
  adminDeliveryFeesSchema,
  adminProductDetailSchema,
  adminProductListSchema,
  adminSettingsSchema,
  uploadedImageSchema,
  adminOrderListSchema,
  adminOrderSchema,
  adminOrderUpdatesSchema,
  adminSchema,
  adminSearchResultSchema,
  apiErrorSchema,
  blacklistEntrySchema,
  bulkShipResultSchema,
  productSchema,
  type AdminLogin,
  type AdminOrderEdit,
  type AdminOrderQuery,
  type AdminProductFlags,
  type AdminProductInput,
  type AdminProductQuery,
  type AdminStockUpdate,
  type DeliveryBulk,
  type DeliveryFeeUpdate,
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
      // JSON bodies are strings; a FormData (photo upload) sets its own multipart type.
      headers: {
        ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
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

/** Global search of the top bar: orders (name, phone, order number) and products. */
export function searchDashboard(q: string, signal?: AbortSignal) {
  return requestJson(
    `${ADMIN_API_PATHS.search}?${new URLSearchParams({ q })}`,
    adminSearchResultSchema,
    { signal },
  );
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

/** Saves the file of a response (CSV) in the browser. */
async function saveDownload(response: Response, fallbackName: string) {
  const blob = await response.blob();
  const name =
    /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ??
    fallbackName;
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Downloads the Anderson CSV; returns the ids of the exported orders. */
export async function exportForAnderson(selection: { ids: string[] } | { all: true }) {
  const response = await request(ADMIN_API_PATHS.andersonExport, send("POST", selection));
  await saveDownload(response, "anderson.csv");
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

// ---------- Products ----------

const queryString = (query: object) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
};

export function fetchAdminProducts(query: AdminProductQuery) {
  return requestJson(`${ADMIN_API_PATHS.products}?${queryString(query)}`, adminProductListSchema);
}

export function fetchAdminProduct(id: string) {
  return requestJson(ADMIN_API_PATHS.product(id), adminProductDetailSchema);
}

export function createAdminProduct(product: AdminProductInput) {
  return requestJson(ADMIN_API_PATHS.products, adminProductDetailSchema, send("POST", { product }));
}

/** `updatedAt` of the loaded product: the API refuses the save if it changed meanwhile. */
export function updateAdminProduct(id: string, product: AdminProductInput, updatedAt: string) {
  return requestJson(
    ADMIN_API_PATHS.product(id),
    adminProductDetailSchema,
    send("PUT", { product, updatedAt }),
  );
}

export function updateProductStock(id: string, update: AdminStockUpdate) {
  return requestJson(
    ADMIN_API_PATHS.productStock(id),
    adminProductDetailSchema,
    send("PATCH", update),
  );
}

export function setProductFlags(id: string, flags: AdminProductFlags) {
  return requestJson(
    ADMIN_API_PATHS.productFlags(id),
    adminProductDetailSchema,
    send("PATCH", flags),
  );
}

export function duplicateAdminProduct(id: string) {
  return requestJson(ADMIN_API_PATHS.productDuplicate(id), adminProductDetailSchema, {
    method: "POST",
  });
}

export async function deleteAdminProduct(id: string): Promise<void> {
  await request(ADMIN_API_PATHS.product(id), { method: "DELETE" });
}

/** Uploads one photo to the image storage (through the API, which keeps the secret). */
export async function uploadProductImage(file: File) {
  const body = new FormData();
  body.append("image", file);
  const { image } = await requestJson(
    ADMIN_API_PATHS.uploads,
    z.object({ image: uploadedImageSchema }),
    { method: "POST", body },
  );
  return image;
}

/** A photo removed before the product was saved (deleted unless something uses it). */
export async function discardUploadedImage(url: string): Promise<void> {
  await request(ADMIN_API_PATHS.uploads, send("DELETE", { url })).catch(() => undefined);
}

// ---------- Delivery prices ----------

export function fetchAdminDeliveryFees() {
  return requestJson(ADMIN_API_PATHS.deliveryFees, adminDeliveryFeesSchema);
}

/** `preview`: returns the result and the warnings without saving. */
export function updateDeliveryFee(code: number, update: DeliveryFeeUpdate, preview = false) {
  return requestJson(
    `${ADMIN_API_PATHS.deliveryFee(code)}${preview ? "?apercu=1" : ""}`,
    adminDeliveryFeesSchema,
    send("PUT", update),
  );
}

export function bulkUpdateDeliveryFees(bulk: DeliveryBulk, preview = false) {
  return requestJson(
    `${ADMIN_API_PATHS.deliveryBulk}${preview ? "?apercu=1" : ""}`,
    adminDeliveryFeesSchema,
    send("POST", bulk),
  );
}

export function fetchAdminSettings() {
  return requestJson(ADMIN_API_PATHS.settings, adminSettingsSchema);
}

export function saveAdminSettings(settings: AdminSettingsUpdate) {
  return requestJson(ADMIN_API_PATHS.settings, adminSettingsSchema, send("PUT", settings));
}

// ---------- Tableau de bord and Publicité ----------

export function fetchDashboardStats(range: StatsQuery) {
  return requestJson(`${ADMIN_API_PATHS.stats}?${queryString(range)}`, dashboardStatsSchema);
}

export function fetchAdsPage(range: StatsQuery) {
  return requestJson(`${ADMIN_API_PATHS.ads}?${queryString(range)}`, adsPageSchema);
}

const adResponse = z.object({ entry: adSpendSchema });

export async function createAdSpend(entry: AdSpendInput) {
  return (await requestJson(ADMIN_API_PATHS.ads, adResponse, send("POST", entry))).entry;
}

export async function updateAdSpend(id: string, entry: AdSpendInput) {
  return (await requestJson(ADMIN_API_PATHS.ad(id), adResponse, send("PUT", entry))).entry;
}

export async function deleteAdSpend(id: string) {
  await request(ADMIN_API_PATHS.ad(id), { method: "DELETE" });
}

// ---------- Clients ----------

export function fetchClients(query: AdminClientQuery) {
  return requestJson(`${ADMIN_API_PATHS.clients}?${queryString(query)}`, adminClientListSchema);
}

export function fetchClient(phone: string) {
  return requestJson(ADMIN_API_PATHS.client(phone), adminClientDetailSchema);
}

export async function exportClients(query: AdminClientQuery) {
  const { page: _page, limit: _limit, ...filters } = query;
  const response = await request(`${ADMIN_API_PATHS.clientsExport}?${queryString(filters)}`);
  await saveDownload(response, "clients.csv");
}

// ---------- Messages ----------

const messageResponse = z.object({ message: adminMessageSchema });

export function fetchMessages(query: AdminMessageQuery) {
  return requestJson(`${ADMIN_API_PATHS.messages}?${queryString(query)}`, adminMessageListSchema);
}

/** Opening a message marks it read. */
export async function fetchMessage(id: string) {
  return (await requestJson(ADMIN_API_PATHS.message(id), messageResponse)).message;
}

export async function updateMessage(id: string, update: AdminMessageUpdate) {
  return (await requestJson(ADMIN_API_PATHS.message(id), messageResponse, send("PATCH", update)))
    .message;
}

export async function deleteMessage(id: string) {
  await request(ADMIN_API_PATHS.message(id), { method: "DELETE" });
}

// ---------- Abonnés ----------

export function fetchSubscribers(query: AdminSubscriberQuery) {
  return requestJson(
    `${ADMIN_API_PATHS.subscribers}?${queryString(query)}`,
    adminSubscriberListSchema,
  );
}

export async function exportSubscribers(query: AdminSubscriberQuery) {
  const { page: _page, limit: _limit, ...filters } = query;
  const response = await request(`${ADMIN_API_PATHS.subscribersExport}?${queryString(filters)}`);
  await saveDownload(response, "abonnes.csv");
}

export async function deleteSubscriber(id: string) {
  await request(ADMIN_API_PATHS.subscriber(id), { method: "DELETE" });
}

export async function retrySubscriberSync(id: string) {
  return (
    await requestJson(
      ADMIN_API_PATHS.subscriberSync(id),
      z.object({ subscriber: adminSubscriberSchema }),
      { method: "POST" },
    )
  ).subscriber;
}
