import { Schema, model, type Types } from "mongoose";

export interface NewsletterSubscriberDoc {
  _id: Types.ObjectId;
  /** Lowercased; unique (signing up twice keeps one entry). */
  email: string;
  client: { ip: string | null; userAgent: string | null };
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
  },
  { timestamps: true, versionKey: false },
);
newsletterSubscriberSchema.index({ createdAt: -1 });

export const NewsletterSubscriberModel = model<NewsletterSubscriberDoc>(
  "NewsletterSubscriber",
  newsletterSubscriberSchema,
);
