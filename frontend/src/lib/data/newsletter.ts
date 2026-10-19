import type { NewsletterForm } from "@rassm/shared";

/**
 * Subscribes an email to the newsletter. No API yet: it only simulates the request.
 * In the "connect" step this POSTs to the backend, which validates with the same schema.
 */
export async function subscribeToNewsletter(_data: NewsletterForm): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400));
}
