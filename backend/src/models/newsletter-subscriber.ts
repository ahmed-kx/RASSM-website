import { SUBSCRIBER_SYNC_STATUSES, type SubscriberSyncStatus } from "@rassm/shared";
import { Schema, model, type Types } from "mongoose";

export interface NewsletterSubscriberDoc {
  _id: Types.ObjectId;
  /** Lowercased; unique (signing up twice keeps one entry). */
  email: string;
  client: { ip: string | null; userAgent: string | null };
  /** Brevo list sync (BREVO_NEWSLETTER_LIST_ID). Absent = never tried (sign-ups before step 3D). */
  brevo?: { status: SubscriberSyncStatus; error?: string | null; at?: Date | null };
  createdAt: Date;
  updatedAt: Date;
}

const newsletterSubscriberSchema = new Schema<NewsletterSubscriberDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    client: {
      ip: { type: String, default: null },
      userAgent: { type: String, default: null },
    },
    brevo: {
      status: { type: String, enum: SUBSCRIBER_SYNC_STATUSES },
      error: { type: String, default: null },
      at: { type: Date, default: null },
    },
  },
  { timestamps: true, versionKey: false },
);
newsletterSubscriberSchema.index({ createdAt: -1 });

export const NewsletterSubscriberModel = model<NewsletterSubscriberDoc>(
  "NewsletterSubscriber",
  newsletterSubscriberSchema,
);
