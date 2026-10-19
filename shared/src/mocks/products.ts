import { z } from "zod";
import {
  createProductSchema,
  type productSchema,
  type Product,
  type ProductColor,
} from "../schemas/product";
import { getMaxHomeDeliveryPrice } from "../utils/delivery-fee";
import { mockDeliveryFees } from "./delivery-fees";

const BLACK: ProductColor = { name: "Noir", hex: "#111111" };
const CREAM: ProductColor = { name: "Crème", hex: "#EDE8DF" };

/** Photos in frontend/public/images/products/. Add "back" when a back photo exists. */
const images = (slug: string, views: ("front" | "back")[] = ["front"]) =>
  views.map((view) => `/images/products/${slug}-${view}.jpg`);

const rawProducts = [
  // The 5 featured products from design/Homepage.png
  {
    id: "prod_001",
    name: "Signature Hoodie",
    slug: "signature-hoodie",
    description:
      "Le hoodie essentiel RASSM. Molleton gratté épais, coupe oversize, épaules tombantes et petit logo brodé sur la poitrine. Discret à l'extérieur.",
    category: "hoodie",
    price: 7900,
    images: images("signature-hoodie"),
    colors: [BLACK],
    stock: { S: 6, M: 12, L: 14, XL: 8, XXL: 4 },
    featured: true,
    isActive: true,
    deliveryDiscountTiers: [{ type: "free", minQuantity: 2 }],
    drop: "Drop 001",
    createdAt: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "prod_002",
    name: "Sketch Hoodie",
    slug: "sketch-hoodie",
    description:
      "Hoodie oversize crème avec un croquis dessiné à la main imprimé dans le dos. Chaque trait est né d'un sentiment sans mots.",
    category: "hoodie",
    price: 7900,
    images: images("sketch-hoodie", ["front", "back"]),
    colors: [CREAM],
    stock: { S: 4, M: 9, L: 10, XL: 6, XXL: 2 },
    featured: true,
    isActive: true,
    deliveryDiscountTiers: [],
    drop: "Drop 001",
    createdAt: "2026-09-01T10:05:00.000Z",
  },
  {
    id: "prod_003",
    name: "Fragment Sweatshirt",
    slug: "fragment-sweatshirt",
    description:
      "Sweatshirt col rond noir avec un portrait fragmenté imprimé. Coupe carrée, poignets et bas côtelés, intérieur gratté tout doux.",
    category: "sweatshirt",
    price: 6900,
    images: images("fragment-sweatshirt"),
    colors: [BLACK],
    stock: { S: 5, M: 10, L: 10, XL: 5, XXL: 3 },
    featured: true,
    isActive: true,
    deliveryDiscountTiers: [
      { type: "amount", minQuantity: 1, amount: 100 },
      { type: "amount", minQuantity: 2, amount: 200 },
      { type: "free", minQuantity: 3 },
    ],
    drop: "Drop 001",
    createdAt: "2026-09-01T10:10:00.000Z",
  },
  {
    id: "prod_004",
    name: "Unspoken Tee",
    slug: "unspoken-tee",
    description:
      "T-shirt oversize crème en coton épais, avec le croquis au fusain d'un visage qui détourne le regard. Pour ce que l'on garde pour soi.",
    category: "tshirt",
    price: 4900,
    images: images("unspoken-tee"),
    colors: [CREAM],
    stock: { S: 8, M: 15, L: 15, XL: 9, XXL: 4 },
    featured: true,
    isActive: true,
    deliveryDiscountTiers: [{ type: "amount", minQuantity: 1, amount: 50 }],
    drop: "Drop 001",
    createdAt: "2026-09-01T10:15:00.000Z",
  },
  {
    id: "prod_005",
    name: "Classic Tee",
    slug: "classic-tee",
    description:
      "T-shirt oversize noir avec le logo RASSM et le slogan imprimés sur la poitrine. La pièce de tous les jours de la collection.",
    category: "tshirt",
    price: 4900,
    images: images("classic-tee"),
    colors: [BLACK, CREAM],
    stock: { S: 10, M: 20, L: 20, XL: 12, XXL: 6 },
    featured: true,
    isActive: true,
    deliveryDiscountTiers: [],
    drop: "Drop 001",
    createdAt: "2026-09-01T10:20:00.000Z",
  },
  // Extra products for the collection page
  {
    id: "prod_006",
    name: "Silence Hoodie",
    slug: "silence-hoodie",
    description:
      "Hoodie oversize noir avec une grande silhouette dessinée imprimée dans le dos. Capuche doublée et poche kangourou.",
    category: "hoodie",
    price: 8400,
    images: images("silence-hoodie"),
    colors: [BLACK],
    stock: { S: 3, M: 7, L: 8, XL: 5, XXL: 0 },
    featured: false,
    isActive: true,
    deliveryDiscountTiers: [],
    drop: "Drop 001",
    createdAt: "2026-09-15T09:00:00.000Z",
  },
  {
    id: "prod_007",
    name: "Echo Sweatshirt",
    slug: "echo-sweatshirt",
    description:
      "Sweatshirt col rond crème avec des traits d'encre répétés sur la poitrine. Coupe ample, molleton mi-épais.",
    category: "sweatshirt",
    price: 6900,
    images: images("echo-sweatshirt"),
    colors: [BLACK],
    stock: { S: 4, M: 8, L: 8, XL: 4, XXL: 2 },
    featured: false,
    isActive: true,
    deliveryDiscountTiers: [],
    drop: "Drop 001",
    createdAt: "2026-09-15T09:05:00.000Z",
  },
  {
    id: "prod_008",
    name: "Inner Voice Tee",
    slug: "inner-voice-tee",
    description:
      'T-shirt oversize noir avec une citation manuscrite dans le dos : "Some things live better in art." Coton épais.',
    category: "tshirt",
    price: 4900,
    images: images("inner-voice-tee"),
    colors: [CREAM],
    stock: { S: 0, M: 6, L: 9, XL: 5, XXL: 2 },
    featured: false,
    isActive: true,
    deliveryDiscountTiers: [],
    drop: "Drop 001",
    createdAt: "2026-09-15T09:10:00.000Z",
  },
  {
    id: "prod_009",
    name: "Canvas Hoodie",
    slug: "canvas-hoodie",
    description:
      "Hoodie anthracite délavé, imprimé de croquis superposés comme une page de carnet. Première pièce du prochain drop.",
    category: "hoodie",
    price: 8900,
    images: images("canvas-hoodie", ["front", "back"]),
    colors: [{ name: "Anthracite", hex: "#3A3937" }],
    stock: { S: 2, M: 5, L: 6, XL: 4, XXL: 2 },
    featured: false,
    isActive: true,
    deliveryDiscountTiers: [],
    drop: "Drop 002",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
] satisfies z.input<typeof productSchema>[];

// Discounts must stay below the highest home delivery price in the fee table.
const productListSchema = z
  .array(createProductSchema(getMaxHomeDeliveryPrice(mockDeliveryFees)))
  .superRefine((products, ctx) => {
    for (const key of ["id", "slug"] as const) {
      const seen = new Set<string>();
      products.forEach((product, index) => {
        if (seen.has(product[key])) {
          ctx.addIssue({ code: "custom", path: [index, key], message: `${key} en double.` });
        }
        seen.add(product[key]);
      });
    }
  });

/** Parsed at module load: a mismatch with the schema throws immediately. */
export const mockProducts: readonly Product[] = productListSchema.parse(rawProducts);

export const mockFeaturedProducts = mockProducts.filter((p) => p.featured && p.isActive);

export function getMockProductBySlug(slug: string): Product | undefined {
  return mockProducts.find((product) => product.slug === slug);
}
