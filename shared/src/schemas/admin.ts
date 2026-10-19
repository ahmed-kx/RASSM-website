import { z } from "zod";
import { idSchema, isoDateSchema } from "./common";
import { algerianPhoneSchema, refineAddressForHomeDelivery } from "./customer";
import { orderFieldsSchema, orderStatusSchema, type OrderStatus } from "./order";
import { productOrderFieldsSchema } from "./product-order";

// Admin dashboard: shapes shared by the admin API (backend) and the dashboard (frontend).
// Labels are French (the dashboard is in French).

/** Password rules for an admin account (create-admin script). */
export const adminPasswordSchema = z
  .string({ error: "Veuillez entrer un mot de passe." })
  .min(10, "Le mot de passe doit contenir au moins 10 caractères.")
  .max(200, "Le mot de passe est trop long.");

export const adminSchema = z.object({
  id: idSchema,
  email: z.email(),
});
export type Admin = z.infer<typeof adminSchema>;

/**
 * Allowed status changes. A new order is "pending" (reçue) until the confirmation call.
 * No "delivered" before "shipped"; a cancelled order can be reopened.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: ["pending"],
  returned: [],
};

export function canChangeStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/** Statuses where the ordered units are taken from the stock. */
export const STOCK_HOLDING_STATUSES: readonly OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
];

/** Orders can be edited (size, color, quantity, address…) until they are shipped. */
export const EDITABLE_STATUSES: readonly OrderStatus[] = ["pending", "confirmed"];

/** Button label of each target status. */
export const ORDER_STATUS_ACTION_LABELS: Record<OrderStatus, string> = {
  pending: "Réactiver",
  confirmed: "Confirmer",
  shipped: "Marquer expédiée",
  delivered: "Marquer livrée",
  cancelled: "Annuler",
  returned: "Marquer retournée",
};

/** Tabs of the orders list ("all" = every status). */
export const ORDER_TABS = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "all",
] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

export const ORDER_TAB_LABELS: Record<OrderTab, string> = {
  pending: "Nouvelles",
  confirmed: "Confirmées",
  shipped: "Expédiées",
  delivered: "Livrées",
  cancelled: "Annulées",
  returned: "Retournées",
  all: "Toutes",
};

/** One line of an order's history (status changes, edits, notes, blacklist). */
export const orderHistoryEntrySchema = z.object({
  at: isoDateSchema,
  /** Admin e-mail, or null for the customer / the system. */
  by: z.string().nullable(),
  type: z.enum(["created", "status", "edit", "blacklist"]),
  status: orderStatusSchema.optional(),
  /** French description, e.g. "Taille M → L". */
  message: z.string(),
});
export type OrderHistoryEntry = z.infer<typeof orderHistoryEntrySchema>;

export const blacklistInfoSchema = z.object({ reason: z.string(), createdAt: isoDateSchema });

/** An order as the dashboard sees it: everything, internal data included. */
export const adminOrderSchema = orderFieldsSchema.extend({
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  suspicious: z.boolean(),
  suspiciousReason: z.string().nullable(),
  /** Set when the phone number is on the blacklist (checked when the order is read). */
  blacklist: blacklistInfoSchema.nullable(),
  /** Null until an admin opens the order ("Nouveau" badge). */
  openedAt: isoDateSchema.nullable(),
  adminNote: z.string(),
  history: z.array(orderHistoryEntrySchema),
  /** True while the ordered units are taken from the stock. */
  stockReserved: z.boolean(),
  metaPurchaseStatus: z.enum(["pending", "sent", "failed", "skipped"]),
  updatedAt: isoDateSchema,
});
export type AdminOrder = z.infer<typeof adminOrderSchema>;

/** Filters of the orders list (query string). Invalid values are ignored. */
export const adminOrderQuerySchema = z.object({
  status: z.enum(ORDER_TABS).catch("pending"),
  /** Name, phone (spaces allowed) or internal order number ("RSM-000123", "123"). */
  q: z.string().trim().max(80).optional().catch(undefined),
  wilaya: z.coerce.number().int().min(1).max(58).optional().catch(undefined),
  /** Algiers dates, YYYY-MM-DD, inclusive. */
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  /** Page size and cursor (createdAt ISO of the last order of the previous page + id). */
  limit: z.coerce.number().int().min(1).max(100).catch(30),
  cursor: z.string().max(100).optional().catch(undefined),
  /** Numbered pages (1 = newest), used instead of the cursor by the dashboard table. */
  page: z.coerce.number().int().min(1).max(100_000).optional().catch(undefined),
});
/** Query of the orders list, as the dashboard sends it. */
export interface AdminOrderQuery {
  status?: OrderTab;
  q?: string;
  wilaya?: number | string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
  page?: number;
}

export const adminOrderListSchema = z.object({
  orders: z.array(adminOrderSchema),
  nextCursor: z.string().nullable(),
  /** Orders per tab, with the same search and filters. */
  counts: z.record(z.enum(ORDER_TABS), z.number().int().nonnegative()),
});
export type AdminOrderList = z.infer<typeof adminOrderListSchema>;

/** Global search of the dashboard top bar (orders and products). */
export const adminSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80).catch(""),
});

export const adminSearchResultSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string(),
      orderNumber: z.string(),
      fullName: z.string(),
      phone: z.string(),
      status: orderStatusSchema,
      total: z.number().int().nonnegative(),
      createdAt: isoDateSchema,
      productName: z.string(),
    }),
  ),
  products: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      image: z.string(),
      price: z.number().int().nonnegative(),
      /** Units left, all colors and sizes. */
      stock: z.number().int().nonnegative(),
      isActive: z.boolean(),
    }),
  ),
});
export type AdminSearchResult = z.infer<typeof adminSearchResultSchema>;

/** Polling answer: orders created after `since`, and the "Nouveau" counter. */
export const adminOrderUpdatesSchema = z.object({
  orders: z.array(adminOrderSchema),
  unopened: z.number().int().nonnegative(),
  serverTime: isoDateSchema,
});
export type AdminOrderUpdates = z.infer<typeof adminOrderUpdatesSchema>;

export const adminStatusChangeSchema = z.object({
  status: orderStatusSchema,
});

export const adminNoteSchema = z.object({
  note: z
    .string({ error: "Note invalide." })
    .trim()
    .max(2000, "La note ne doit pas dépasser 2 000 caractères."),
});

/**
 * Order changes after the confirmation call (before shipping): variant, quantity and
 * delivery details. The API recomputes every amount and adjusts the stock.
 */
export const adminOrderEditSchema = productOrderFieldsSchema
  .pick({
    color: true,
    size: true,
    quantity: true,
    fullName: true,
    phone: true,
    wilayaCode: true,
    commune: true,
    address: true,
    deliveryType: true,
  })
  .superRefine(refineAddressForHomeDelivery);
export type AdminOrderEdit = z.output<typeof adminOrderEditSchema>;

export const blacklistEntrySchema = z.object({
  phone: z.string(),
  reason: z.string(),
  createdAt: isoDateSchema,
  createdBy: z.string().nullable(),
  /** Orders placed with this number. */
  orderCount: z.number().int().nonnegative(),
});
export type BlacklistEntry = z.infer<typeof blacklistEntrySchema>;

export const blacklistAddSchema = z.object({
  phone: algerianPhoneSchema,
  reason: z
    .string({ error: "Indiquez une raison." })
    .trim()
    .min(3, "Indiquez une raison (ex. colis refusé).")
    .max(200, "La raison ne doit pas dépasser 200 caractères."),
});

/** Anderson export: chosen confirmed orders, or every confirmed order. */
export const andersonExportSchema = z
  .object({
    ids: z.array(idSchema).max(500).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => value.all === true || (value.ids?.length ?? 0) > 0, {
    message: "Sélectionnez au moins une commande.",
  });

export const bulkShipSchema = z.object({
  ids: z.array(idSchema).min(1, "Sélectionnez au moins une commande.").max(500),
});

export const bulkShipResultSchema = z.object({
  shipped: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
