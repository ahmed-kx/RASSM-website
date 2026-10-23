import { SUBSCRIBER_SYNC_STATUSES, type SubscriberSyncStatus } from "@rassm/shared";
import { Schema, model, type Types } from "mongoose";

export interface NewsletterSubscriberDoc {
  _id: Types.ObjectId;
  /** Lowercased; unique (signing up twice keeps one entry). */
  email: string;
  /** Deleted after 12 months (services/data-retention.ts). */
  client: { ip: string | null; userAgent: string | null };
  /** Signed up too fast or without the site's form (bot check): no confirmation e-mail sent. */
  suspicious?: boolean;
  suspiciousReason?: string | null;
  /**
   * Double opt-in: present until the subscriber clicks the link of the confirmation e-mail
   * (only the SHA-256 of the token is kept). Absent = confirmed (or signed up before the double
   * opt-in existed). Only confirmed subscribers are added to the Brevo list.
   */
  confirmationPending?: { tokenHash: string | null; sentAt: Date | null; expiresAt: Date | null };
  confirmedAt?: Date | null;
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
    suspicious: { type: Boolean, default: false },
    suspiciousReason: { type: String, default: null },
    confirmationPending: {
      type: new Schema(
        { tokenHash: String, sentAt: Date, expiresAt: Date },
        { _id: false, versionKey: false },
      ),
      default: undefined,
    },
    confirmedAt: { type: Date, default: null },
    brevo: {
      status: { type: String, enum: SUBSCRIBER_SYNC_STATUSES },
      error: { type: String, default: null },
      at: { type: Date, default: null },
    },
  },
  { timestamps: true, versionKey: false },
);
newsletterSubscriberSchema.index({ createdAt: -1 });
newsletterSubscriberSchema.index(
  { "confirmationPending.tokenHash": 1 },
  { partialFilterExpression: { "confirmationPending.tokenHash": { $type: "string" } } },
);

export const NewsletterSubscriberModel = model<NewsletterSubscriberDoc>(
  "NewsletterSubscriber",
  newsletterSubscriberSchema,
);

/** Subscribers who confirmed their address (or signed up before the double opt-in). */
export const CONFIRMED_SUBSCRIBERS = { confirmationPending: { $exists: false } } as const;
