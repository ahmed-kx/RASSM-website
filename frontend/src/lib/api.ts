import { apiErrorSchema } from "@rassm/shared";
import type { z } from "zod";

// HTTP client of the RASSM API. Server components read API_URL (server only) when it is
// set, the browser reads NEXT_PUBLIC_API_URL.

const API_URL =
  (typeof window === "undefined" ? process.env.API_URL : undefined) ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

const NETWORK_ERROR =
  "Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.";
const GENERIC_ERROR = "Une erreur est survenue. Veuillez réessayer dans un instant.";

/** An API error: HTTP status, French message, and a French message per form field. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = apiErrorSchema.safeParse(await response.json().catch(() => null));
  return body.success
    ? new ApiError(response.status, body.data.error.message, body.data.error.fields)
    : new ApiError(response.status, GENERIC_ERROR);
}

/**
 * GET, cached by Next for `revalidate` seconds (so stock and prices stay fresh without
 * calling the API on every visit). Returns null on 404.
 */
export async function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  { revalidate }: { revalidate: number },
): Promise<z.output<T> | null> {
  const response = await fetch(`${API_URL}${path}`, { next: { revalidate } });
  if (response.status === 404) return null;
  if (!response.ok) throw await toApiError(response);
  return schema.parse(await response.json());
}

/** POST JSON from the browser. Throws an ApiError with French messages. */
export async function apiPost<T extends z.ZodType>(
  path: string,
  body: unknown,
  schema: T,
): Promise<z.output<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }
  if (!response.ok) throw await toApiError(response);
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new ApiError(response.status, GENERIC_ERROR);
  return parsed.data;
}
