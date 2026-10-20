import { z } from "zod";
import { CATEGORIES, SIZES, imageUrlSchema, isoDateSchema, type Category } from "./common";
import { deliveryDiscountTiersSchema } from "./delivery-discount";
import {
  checkTierAmounts,
  productColorSchema,
  productSchema,
  stockBySizeSchema,
  type Product,
} from "./product";

// Dashboard: products list, form, stock grid and photos (design/admin-products.png).

export const MAX_PHOTOS_PER_COLOR = 12;
export const MAX_COLORS_PER_PRODUCT = 8;
/**
 * A product is "Stock faible" when its total stock (all colors and sizes) is at or below this
 * number. The default; the admin changes it in the dashboard (stored in the database).
 */
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
/** Inside the stock grid only: a variant with 1 to this many units is highlighted. */
export const LOW_VARIANT_STOCK = 3;

/** Photo upload limits (checked by the API before Cloudinary). */
export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** Prix de revient (DA): optional (null = not filled in), admin only, never public. */
export const costPriceSchema = z
  .number({ error: "Le prix de revient doit être un nombre." })
  .int("Le prix de revient doit être un nombre entier de dinars.")
  .min(0, "Le prix de revient ne peut pas être négatif.")
  .max(1_000_000, "Le prix de revient ne peut pas dépasser 1 000 000 DA.")
  .nullable();

const adminProductColorSchema = productColorSchema.extend({
  images: z
    .array(imageUrlSchema)
    .min(1, "Ajoutez au moins une photo pour cette couleur.")
    .max(MAX_PHOTOS_PER_COLOR, `${MAX_PHOTOS_PER_COLOR} photos au maximum par couleur.`),
});

/**
 * What the product form sends (create and edit). The API sets the id, the SKU, the creation
 * date and the product photos (those of the first color; its first photo is the main one).
 */
export const adminProductInputSchema = productSchema
  .omit({ id: true, sku: true, createdAt: true, images: true })
  .extend({
    // The form always sends the list (no default), so input and output types match.
    deliveryDiscountTiers: deliveryDiscountTiersSchema.unwrap(),
    /** Admin only (profit statistics). Null or absent = not filled in. */
    costPrice: costPriceSchema.optional(),
    colors: z
      .array(adminProductColorSchema)
      .min(1, "Ajoutez au moins une couleur.")
      .max(MAX_COLORS_PER_PRODUCT, `${MAX_COLORS_PER_PRODUCT} couleurs au maximum.`)
      .superRefine((colors, ctx) => {
        const seen = new Set<string>();
        colors.forEach((color, index) => {
          const key = color.name.trim().toLocaleLowerCase("fr");
          if (seen.has(key)) {
            ctx.addIssue({
              code: "custom",
              path: [index, "name"],
              message: "Deux couleurs ne peuvent pas avoir le même nom.",
            });
          }
          seen.add(key);
        });
      }),
  });
export type AdminProductInput = z.infer<typeof adminProductInputSchema>;

/** The form schema with the tier limit from the fee table (never hard-coded). */
export function createAdminProductInputSchema(maxHomeDeliveryPrice: number) {
  return adminProductInputSchema.superRefine((input, ctx) =>
    checkTierAmounts(input.deliveryDiscountTiers, maxHomeDeliveryPrice, ctx),
  );
}

/** Product fields from the form input (the photos of the first color are the product's). */
export function productImagesOf(input: Pick<AdminProductInput, "colors">): string[] {
  return input.colors[0]?.images ?? [];
}

// ---------- Status and stock ----------

export const PRODUCT_STATUSES = ["active", "low", "out", "hidden"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: "Actif",
  low: "Stock faible",
  out: "Rupture",
  hidden: "Masqué",
};

/** Units left, all colors and sizes. */
export function getTotalStock(product: Pick<Product, "colors">): number {
  return product.colors.reduce(
    (sum, color) => sum + SIZES.reduce((units, size) => units + color.stock[size], 0),
    0,
  );
}

export type StockLevel = "ok" | "low" | "out";

/** "out" (total 0), "low" (total at or below the threshold) or "ok". */
export function getStockLevel(
  product: Pick<Product, "colors">,
  lowStockThreshold: number,
): StockLevel {
  const total = getTotalStock(product);
  if (total === 0) return "out";
  return total <= lowStockThreshold ? "low" : "ok";
}

/** Masqué (hidden from the site) first, then Rupture, Stock faible, Actif. */
export function getProductStatus(
  product: Pick<Product, "colors" | "isActive">,
  lowStockThreshold: number,
): ProductStatus {
  if (!product.isActive) return "hidden";
  const level = getStockLevel(product, lowStockThreshold);
  return level === "out" ? "out" : level === "low" ? "low" : "active";
}

/** A variant with 1 to 3 units (highlighted in the stock grid only). */
export const isLowVariantStock = (units: number) => units > 0 && units <= LOW_VARIANT_STOCK;

// ---------- Settings ----------

/** A cost in whole DA (settings, cost price). */
const costDaSchema = (what: string) =>
  z
    .number({ error: `Indiquez ${what} en DA.` })
    .int(`Indiquez ${what} en DA, sans centimes.`)
    .min(0, `${what.charAt(0).toUpperCase()}${what.slice(1)} ne peut pas être négatif.`)
    .max(
      1_000_000,
      `${what.charAt(0).toUpperCase()}${what.slice(1)} ne peut pas dépasser 1 000 000 DA.`,
    );

/**
 * Dashboard settings stored in the database. The packaging and return costs are copied on
 * each order when it becomes delivered or returned, so a later change never rewrites past
 * profit.
 */
export const adminSettingsSchema = z.object({
  lowStockThreshold: z
    .number({ error: "Indiquez un nombre d'unités." })
    .int("Indiquez un nombre entier d'unités.")
    .min(0, "Le seuil ne peut pas être négatif.")
    .max(10_000, "Le seuil ne peut pas dépasser 10 000 unités."),
  /** Coût d'emballage par commande (DA). */
  packagingCost: costDaSchema("le coût d'emballage"),
  /** What the courier charges for a refused / returned order (DA). */
  returnCost: costDaSchema("le coût d'un retour"),
});
export type AdminSettings = z.infer<typeof adminSettingsSchema>;
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
  packagingCost: 0,
  returnCost: 0,
};

/** PUT /api/admin/settings: any of the settings (the others are kept). */
export const adminSettingsUpdateSchema = adminSettingsSchema
  .partial()
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Rien à modifier.",
  });
export type AdminSettingsUpdate = z.infer<typeof adminSettingsUpdateSchema>;

// ---------- List ----------

export const PRODUCT_SORTS = [
  "newest",
  "oldest",
  "name",
  "price-asc",
  "price-desc",
  "stock-asc",
  "stock-desc",
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  newest: "Plus récents",
  oldest: "Plus anciens",
  name: "Nom (A → Z)",
  "price-asc": "Prix croissant",
  "price-desc": "Prix décroissant",
  "stock-asc": "Stock croissant",
  "stock-desc": "Stock décroissant",
};

export const PRODUCT_TABS = ["all", ...CATEGORIES] as const;
export type ProductTab = (typeof PRODUCT_TABS)[number];

/** Filters of the products list (query string). Invalid values are ignored. */
export const adminProductQuerySchema = z.object({
  category: z.enum(PRODUCT_TABS).catch("all"),
  q: z.string().trim().max(80).optional().catch(undefined),
  status: z.enum([...PRODUCT_STATUSES, "all"]).catch("all"),
  drop: z.string().trim().max(40).optional().catch(undefined),
  sort: z.enum(PRODUCT_SORTS).catch("newest"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(10),
});
export interface AdminProductQuery {
  category?: ProductTab;
  q?: string;
  status?: ProductStatus | "all";
  drop?: string;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export const adminProductRowSchema = productSchema.extend({
  costPrice: costPriceSchema,
  stockTotal: z.number().int().nonnegative(),
  status: z.enum(PRODUCT_STATUSES),
  /** Orders that contain this product (a product with orders can only be hidden). */
  orderCount: z.number().int().nonnegative(),
});
export type AdminProductRow = z.infer<typeof adminProductRowSchema>;

/**
 * A KPI card. `trend` is only set when it is computed from real data: the value now against
 * 30 days ago, with one point per day for the sparkline. Null = no trend shown.
 */
export const kpiSchema = z.object({
  value: z.number(),
  trend: z
    .object({
      percent: z.number(),
      series: z.array(z.number()),
    })
    .nullable(),
});
export type Kpi = z.infer<typeof kpiSchema>;

export const adminProductListSchema = z.object({
  products: z.array(adminProductRowSchema),
  /** Products matching the filters (for the pagination). */
  total: z.number().int().nonnegative(),
  /** Products per category tab, with the search and the other filters. */
  counts: z.record(z.enum(PRODUCT_TABS), z.number().int().nonnegative()),
  /** Drop names in use, for the filter. */
  drops: z.array(z.string()),
  /** Total stock at or below which a product is "Stock faible". */
  lowStockThreshold: z.number().int().nonnegative(),
  kpis: z.object({
    products: kpiSchema,
    drops: kpiSchema,
    stockUnits: kpiSchema,
    /** Stock × price, in DA. */
    stockValue: kpiSchema,
  }),
});
export type AdminProductList = z.infer<typeof adminProductListSchema>;

export const adminProductDetailSchema = z.object({
  product: productSchema,
  /** Admin only: never in the public product. */
  costPrice: costPriceSchema,
  orderCount: z.number().int().nonnegative(),
  /** Sent back on save: the API refuses the change if the product changed meanwhile. */
  updatedAt: isoDateSchema,
});
export type AdminProductDetail = z.infer<typeof adminProductDetailSchema>;

/** Quick stock edit: the stock grid of every color. */
export const adminStockUpdateSchema = z.object({
  updatedAt: isoDateSchema.optional(),
  colors: z
    .array(z.object({ name: z.string().trim().min(1), stock: stockBySizeSchema }))
    .min(1, "Indiquez le stock d'au moins une couleur."),
});
export type AdminStockUpdate = z.infer<typeof adminStockUpdateSchema>;

/** "Visible sur le site" and "Mis en avant" switches. */
export const adminProductFlagsSchema = z
  .object({ isActive: z.boolean().optional(), featured: z.boolean().optional() })
  .refine((flags) => flags.isActive !== undefined || flags.featured !== undefined, {
    message: "Rien à modifier.",
  });
export type AdminProductFlags = z.infer<typeof adminProductFlagsSchema>;

/** A photo uploaded to the image storage (Cloudinary). */
export const uploadedImageSchema = z.object({
  url: imageUrlSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type UploadedImage = z.infer<typeof uploadedImageSchema>;

/** Category label in the singular, for the form ("Hoodie"). */
export const CATEGORY_SINGULAR_LABELS: Record<Category, string> = {
  hoodie: "Hoodie",
  sweatshirt: "Sweatshirt",
  tshirt: "T-shirt",
};
