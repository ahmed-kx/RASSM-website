import { API_PATHS, type ContactForm } from "@rassm/shared";
import { z } from "zod";
import { apiPost } from "@/lib/api";

/**
 * Sends a contact message to the API, which validates it with the same shared schema and
 * saves it (read in the admin dashboard). Throws an ApiError with French messages.
 * `website` is the hidden anti-spam field (empty for real people).
 */
export async function sendContactMessage(data: ContactForm, website = ""): Promise<void> {
  await apiPost(API_PATHS.contactMessages, { ...data, website }, z.object({ ok: z.literal(true) }));
}
