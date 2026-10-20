import { CONTACT_SUBJECT_LABELS } from "@rassm/shared";
import { describeError, logger } from "../lib/logger";
import { ContactMessageModel, type ContactMessageDoc } from "../models/contact-message";
import { formatPhone, renderTeamEmail, sendTeamEmail, type EmailConfig } from "./brevo";

// New contact message e-mail to the team (Brevo), same style as the new order e-mail. Sent in
// the background: a failure is logged and stored on the message, never blocking it.

export type NewMessageEmailMessage = Pick<
  ContactMessageDoc,
  "_id" | "firstName" | "lastName" | "phone" | "email" | "subject" | "message"
>;

export interface MessageNotifier {
  /** Sends the new message e-mail; records the result on the message. Never throws. */
  notifyNewMessage(message: NewMessageEmailMessage): Promise<void>;
}

export function messageLink(adminUrl: string, messageId: string): string {
  return `${adminUrl}/messages/${messageId}`;
}

export function buildNewMessageEmail(message: NewMessageEmailMessage, adminUrl: string) {
  const name = `${message.firstName} ${message.lastName}`;
  const subjectLabel = CONTACT_SUBJECT_LABELS[message.subject];
  const link = messageLink(adminUrl, message._id.toString());
  const rows: [string, string][] = [
    ["Nom", name],
    ["Téléphone", formatPhone(message.phone)],
    ...(message.email ? ([["E-mail", message.email]] as [string, string][]) : []),
    ["Sujet", subjectLabel],
  ];
  const subject = `Nouveau message (${subjectLabel}) : ${name}`;
  const html = renderTeamEmail({
    eyebrow: `Nouveau message · ${subjectLabel}`,
    title: name,
    rows,
    body: message.message,
    button: { label: "Ouvrir le message", href: link },
    footer: "Message envoyé depuis la page Contact du site.",
  });
  const text = [
    `Nouveau message : ${name}`,
    "",
    ...rows.map(([label, value]) => `${label} : ${value}`),
    "",
    message.message,
    "",
    `Ouvrir le message : ${link}`,
  ].join("\n");
  return { subject, html, text };
}

async function record(
  id: NewMessageEmailMessage["_id"],
  status: "sent" | "failed" | "skipped",
  error?: string,
) {
  await ContactMessageModel.updateOne(
    { _id: id },
    {
      $set: {
        "emailNotification.status": status,
        ...(status === "sent" && { "emailNotification.sentAt": new Date() }),
        ...(error && { "emailNotification.error": error.slice(0, 500) }),
      },
    },
  ).catch((dbError: unknown) =>
    logger.error("Could not record the message e-mail status", describeError(dbError)),
  );
}

/** Brevo notifier. Does nothing (status "skipped") without BREVO_API_KEY. */
export function createMessageNotifier(config: EmailConfig | null): MessageNotifier {
  return {
    async notifyNewMessage(message) {
      if (!config) {
        await record(message._id, "skipped");
        return;
      }
      try {
        await sendTeamEmail(config, buildNewMessageEmail(message, config.adminUrl));
        await record(message._id, "sent");
        logger.info("New message e-mail sent", { messageId: message._id.toString() });
      } catch (error) {
        logger.error("New message e-mail failed", {
          messageId: message._id.toString(),
          ...describeError(error),
        });
        await record(message._id, "failed", error instanceof Error ? error.message : String(error));
      }
    },
  };
}
