import { API_PATHS, type NewsletterForm, type NewsletterRequest } from "@rassm/shared";
import { z } from "zod";
import { apiPost } from "@/lib/api";
import type { FormChecks } from "./contact";

/**
 * Subscribes an email to the newsletter. The API validates it with the same schema and
 * keeps one entry per email. Throws an ApiError with French messages.
 */
export async function subscribeToNewsletter(
  data: NewsletterForm,
  { website = "", elapsedMs }: FormChecks = {},
): Promise<void> {
  const body: NewsletterRequest = { ...data, website, elapsedMs };
  await apiPost(API_PATHS.newsletter, body, z.object({ ok: z.literal(true) }));
}
