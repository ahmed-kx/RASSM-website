import { CONTACT_SUBJECTS, type ContactForm } from "@rassm/shared";
import { Schema, model, type Types } from "mongoose";

/** A message from the contact page, read in the admin dashboard. */
export interface ContactMessageDoc extends ContactForm {
  _id: Types.ObjectId;
  /** False until the team has read it in the dashboard. */
  read: boolean;
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
    client: {
      ip: { type: String, default: null },
      userAgent: { type: String, default: null },
    },
  },
  { timestamps: true, versionKey: false },
);
contactMessageSchema.index({ read: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: -1 });

export const ContactMessageModel = model<ContactMessageDoc>("ContactMessage", contactMessageSchema);
