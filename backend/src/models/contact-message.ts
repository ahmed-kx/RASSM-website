import { CONTACT_SUBJECTS, type ContactForm } from "@rassm/shared";
import { Schema, model, type Types } from "mongoose";

/** A message from the contact page, read in the admin dashboard. */
export interface ContactMessageDoc extends ContactForm {
  _id: Types.ObjectId;
  /** False until the team has read it in the dashboard. */
  read: boolean;
  /** Archived messages leave the inbox (kept until deleted). */
  archived: boolean;
  /** Sent too fast or without the site's form (bot check). Kept, shown "Suspect". */
  suspicious: boolean;
  suspiciousReason: string | null;
  /** New message e-mail to the team (Brevo). */
  emailNotification: {
    status: "pending" | "sent" | "failed" | "skipped";
    sentAt?: Date;
    error?: string;
  };
  client: { ip: string | null; userAgent: string | null };
  createdAt: Date;
  updatedAt: Date;
}

const contactMessageSchema = new Schema<ContactMessageDoc>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    subject: { type: String, enum: CONTACT_SUBJECTS, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    suspicious: { type: Boolean, default: false },
    suspiciousReason: { type: String, default: null },
    emailNotification: {
      status: { type: String, enum: ["pending", "sent", "failed", "skipped"], default: "pending" },
      sentAt: Date,
      error: String,
    },
    client: {
      ip: { type: String, default: null },
      userAgent: { type: String, default: null },
    },
  },
  { timestamps: true, versionKey: false },
);
contactMessageSchema.index({ read: 1, createdAt: -1 });
contactMessageSchema.index({ archived: 1, read: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: -1 });

export const ContactMessageModel = model<ContactMessageDoc>("ContactMessage", contactMessageSchema);
