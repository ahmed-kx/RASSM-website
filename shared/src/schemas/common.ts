import { z } from "zod";

// Customer-facing text is French: Zod's built-in messages too (custom messages override them).
// Every schema imports this file, so the locale is always set before any validation.
z.config(z.locales.fr());

export const CATEGORIES = ["hoodie", "sweatshirt", "tshirt"] as const;
export const categorySchema = z.enum(CATEGORIES, { error: "Choisissez une catégorie valide." });
export type Category = z.infer<typeof categorySchema>;

/** French labels shown to customers and in the admin. */
export const CATEGORY_LABELS: Record<Category, string> = {
  hoodie: "Hoodies",
  sweatshirt: "Sweatshirts",
  tshirt: "T-shirts",
};

export const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export const sizeSchema = z.enum(SIZES, { error: "Choisissez une taille." });
export type Size = z.infer<typeof sizeSchema>;

/** Generic non-empty identifier (mock ids now, MongoDB ObjectId strings later). */
export const idSchema = z.string().trim().min(1, "Identifiant manquant.");

/** URL-friendly slug: lowercase letters, digits and single hyphens. */
export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Le slug doit contenir des mots en minuscules séparés par des tirets.",
  );

/** Amount in Algerian Dinar. Whole dinars only, never centimes. */
export const priceDaSchema = z
  .number({ error: "Le prix doit être un nombre." })
  .int("Le prix doit être un nombre entier de dinars.")
  .nonnegative("Le prix ne peut pas être négatif.");

/** Absolute http(s) URL or a site-relative path such as `/images/products/x.jpg`. */
export const imageUrlSchema = z
  .string()
  .regex(
    /^(https?:\/\/|\/)\S+$/,
    "L'image doit être une URL http(s) ou un chemin commençant par /.",
  );

export const hexColorSchema = z
  .string()
  .regex(
    /^#[0-9A-Fa-f]{6}$/,
    "La couleur doit être un code hexadécimal à 6 chiffres, par ex. #111111.",
  );

/** ISO 8601 timestamp string, e.g. `2026-10-17T10:00:00.000Z`. */
export const isoDateSchema = z.iso.datetime({ error: "Date invalide." });
