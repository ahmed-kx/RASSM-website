import { API_PATHS, type NewsletterForm, type NewsletterRequest } from "@rassm/shared";
import { z } from "zod";
import { apiPost } from "@/lib/api";
import type { FormChecks } from "./contact";

/**
 * Subscribes an email to the newsletter. The API validates it with the same schema, keeps one
 * entry per email and sends the confirmation e-mail (double opt-in). Throws an ApiError with
 * French messages.
 */
export async function subscribeToNewsletter(
  data: NewsletterForm,
  { website = "", elapsedMs }: FormChecks = {},
): Promise<void> {
  const body: NewsletterRequest = { ...data, website, elapsedMs };
  await apiPost(API_PATHS.newsletter, body, z.object({ ok: z.literal(true) }));
}

/** The link of the confirmation e-mail. Throws an ApiError (French) when it is no longer valid. */
export async function confirmNewsletter(token: string): Promise<void> {
  await apiPost(API_PATHS.newsletterConfirm, { token }, z.object({ ok: z.literal(true) }));
}
