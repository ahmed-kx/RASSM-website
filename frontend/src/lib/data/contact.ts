import { contactFormSchema, type ContactForm } from "@rassm/shared";

/**
 * Sends a contact message. No API yet: it validates with the shared schema and
 * simulates the request. In the backend step the API validates with the same schema
 * and saves the message (to read it in the admin dashboard).
 */
export async function sendContactMessage(data: ContactForm): Promise<void> {
  contactFormSchema.parse(data);
  await new Promise((resolve) => setTimeout(resolve, 700));
}
