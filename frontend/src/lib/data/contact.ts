import { API_PATHS, type ContactForm, type ContactRequest } from "@rassm/shared";
import { z } from "zod";
import { apiPost } from "@/lib/api";

/** Anti-spam data sent with a public form. */
export interface FormChecks {
  /** Hidden anti-spam field: empty for real people. */
  website?: string;
  /** Milliseconds between the form appearing and its sending (useFormTimer). */
  elapsedMs?: number;
}

/**
 * Sends a contact message to the API, which validates it with the same shared schema and
 * saves it (read in the admin dashboard). Throws an ApiError with French messages.
 */
export async function sendContactMessage(
  data: ContactForm,
  { website = "", elapsedMs }: FormChecks = {},
): Promise<void> {
  const body: ContactRequest = { ...data, website, elapsedMs };
  await apiPost(API_PATHS.contactMessages, body, z.object({ ok: z.literal(true) }));
}
