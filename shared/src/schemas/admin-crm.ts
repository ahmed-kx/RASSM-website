import { z } from "zod";
import { isoDateSchema } from "./common";
import { CONTACT_SUBJECTS, contactSubjectSchema } from "./forms";
import { orderStatusSchema } from "./order";

// Dashboard: clients (grouped from the orders), contact messages and newsletter subscribers.

// ---------- Clients ----------

/** A client is "Fidèle" from this many delivered orders. */
export const LOYAL_DELIVERED_ORDERS = 3;
/** A client is "À risque" from this many returned orders. */
export const AT_RISK_RETURNED_ORDERS = 1;

export const CLIENT_BADGES = ["blacklist", "loyal", "risk"] as const;
export type ClientBadge = (typeof CLIENT_BADGES)[number];
export const CLIENT_BADGE_LABELS: Record<ClientBadge, string> = {
  blacklist: "Liste noire",
  loyal: "Fidèle",
  risk: "À risque",
};

export const CLIENT_SORTS = ["recent", "orders", "spent", "name"] as const;
export type ClientSort = (typeof CLIENT_SORTS)[number];
export const CLIENT_SORT_LABELS: Record<ClientSort, string> = {
  recent: "Dernière commande",
  orders: "Nombre de commandes",
  spent: "Total dépensé",
  name: "Nom (A → Z)",
};

export const adminClientQuerySchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  wilaya: z.coerce.number().int().min(1).max(58).optional().catch(undefined),
  badge: z.enum([...CLIENT_BADGES, "all"]).catch("all"),
  sort: z.enum(CLIENT_SORTS).catch("recent"),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
});
export interface AdminClientQuery {
  q?: string;
  wilaya?: number | string;
  badge?: ClientBadge | "all";
  sort?: ClientSort;
  page?: number;
  limit?: number;
}

/** Customers grouped by phone number (the phone is the client's identity). */
export const adminClientSchema = z.object({
  phone: z.string(),
  /** Name and wilaya of the latest order. */
  name: z.string(),
  wilayaCode: z.number().int(),
  orders: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  /** Totals paid for the delivered orders (articles + delivery), in DA. */
  spent: z.number().int().nonnegative(),
  firstOrderAt: isoDateSchema,
  lastOrderAt: isoDateSchema,
  badges: z.array(z.enum(CLIENT_BADGES)),
});
export type AdminClient = z.infer<typeof adminClientSchema>;

export const adminClientListSchema = z.object({
  clients: z.array(adminClientSchema),
  total: z.number().int().nonnegative(),
});
export type AdminClientList = z.infer<typeof adminClientListSchema>;

export const adminClientDetailSchema = z.object({
  client: adminClientSchema,
  blacklist: z.object({ reason: z.string(), createdAt: isoDateSchema }).nullable(),
  orders: z.array(
    z.object({
      id: z.string(),
      orderNumber: z.string(),
      status: orderStatusSchema,
      productName: z.string(),
      image: z.string(),
      color: z.string(),
      size: z.string(),
      quantity: z.number().int(),
      total: z.number().int(),
      wilayaCode: z.number().int(),
      commune: z.string(),
      createdAt: isoDateSchema,
    }),
  ),
});
export type AdminClientDetail = z.infer<typeof adminClientDetailSchema>;

// ---------- Messages ----------

export const MESSAGE_FOLDERS = ["inbox", "unread", "read", "archived"] as const;
export type MessageFolder = (typeof MESSAGE_FOLDERS)[number];
export const MESSAGE_FOLDER_LABELS: Record<MessageFolder, string> = {
  inbox: "Tous",
  unread: "Non lus",
  read: "Lus",
  archived: "Archivés",
};

export const adminMessageQuerySchema = z.object({
  folder: z.enum(MESSAGE_FOLDERS).catch("inbox"),
  subject: z.enum([...CONTACT_SUBJECTS, "all"]).catch("all"),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
});
export interface AdminMessageQuery {
  folder?: MessageFolder;
  subject?: (typeof CONTACT_SUBJECTS)[number] | "all";
  q?: string;
  page?: number;
  limit?: number;
}

export const adminMessageSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  subject: contactSubjectSchema,
  message: z.string(),
  read: z.boolean(),
  archived: z.boolean(),
  /** Sent too fast or without the site's form (bot check): shown "Suspect". */
  suspicious: z.boolean(),
  suspiciousReason: z.string().nullable(),
  createdAt: isoDateSchema,
});
export type AdminMessage = z.infer<typeof adminMessageSchema>;

export const adminMessageListSchema = z.object({
  messages: z.array(adminMessageSchema),
  total: z.number().int().nonnegative(),
  counts: z.record(z.enum(MESSAGE_FOLDERS), z.number().int().nonnegative()),
});
export type AdminMessageList = z.infer<typeof adminMessageListSchema>;

export const adminMessageUpdateSchema = z
  .object({ read: z.boolean().optional(), archived: z.boolean().optional() })
  .refine((value) => value.read !== undefined || value.archived !== undefined, {
    message: "Rien à modifier.",
  });
export type AdminMessageUpdate = z.infer<typeof adminMessageUpdateSchema>;

// ---------- Newsletter subscribers ----------

/** Brevo list sync: "off" = BREVO_NEWSLETTER_LIST_ID not set. */
/**
 * "unconfirmed": signed up, the confirmation e-mail is sent, the link not clicked yet (double
 * opt-in): not in the Brevo list until it is.
 */
export const SUBSCRIBER_SYNC_STATUSES = [
  "unconfirmed",
  "pending",
  "synced",
  "failed",
  "off",
] as const;
export type SubscriberSyncStatus = (typeof SUBSCRIBER_SYNC_STATUSES)[number];
export const SUBSCRIBER_SYNC_LABELS: Record<SubscriberSyncStatus, string> = {
  unconfirmed: "À confirmer",
  pending: "En cours",
  synced: "Synchronisé",
  failed: "En erreur",
  off: "Non configuré",
};

export const adminSubscriberQuerySchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  sync: z.enum([...SUBSCRIBER_SYNC_STATUSES, "all"]).catch("all"),
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
});
export interface AdminSubscriberQuery {
  q?: string;
  sync?: SubscriberSyncStatus | "all";
  page?: number;
  limit?: number;
}

export const adminSubscriberSchema = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: isoDateSchema,
  sync: z.object({
    status: z.enum(SUBSCRIBER_SYNC_STATUSES),
    /** Short French reason when it failed. */
    error: z.string().nullable(),
    at: isoDateSchema.nullable(),
  }),
});
export type AdminSubscriber = z.infer<typeof adminSubscriberSchema>;

export const adminSubscriberListSchema = z.object({
  subscribers: z.array(adminSubscriberSchema),
  total: z.number().int().nonnegative(),
  /** False when BREVO_API_KEY or BREVO_NEWSLETTER_LIST_ID is missing. */
  brevoConfigured: z.boolean(),
});
export type AdminSubscriberList = z.infer<typeof adminSubscriberListSchema>;
