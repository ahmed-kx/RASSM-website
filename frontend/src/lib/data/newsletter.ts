import { API_PATHS, type NewsletterForm } from "@rassm/shared";
import { z } from "zod";
import { apiPost } from "@/lib/api";

/**
 * Subscribes an email to the newsletter. The API validates it with the same schema and
 * keeps one entry per email. Throws an ApiError with French messages.
 */
export async function subscribeToNewsletter(data: NewsletterForm): Promise<void> {
  await apiPost(API_PATHS.newsletter, data, z.object({ ok: z.literal(true) }));
}
