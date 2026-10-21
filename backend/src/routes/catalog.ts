import { filterAndSortProducts, parseCollectionFilters, slugSchema } from "@rassm/shared";
import { Router, type RequestHandler } from "express";
import { HttpError } from "../lib/http-error";
import { loadDeliveryFees } from "../models/delivery-fee";
import { ProductModel, toProduct, type ProductDoc } from "../models/product";

const PRODUCT_NOT_FOUND = "Produit introuvable.";

/**
 * Products and delivery fees (public, read only, rate limited per IP). `toProduct` keeps the
 * public fields only (never the cost price).
 */
export function catalogRouter(limiter: RequestHandler): Router {
  const router = Router();
  router.use(["/products", "/delivery-fees"], limiter);

  /**
   * Products on sale. Accepts the collection page filters:
   * ?category=hoodie,tshirt&color=noir&size=M&min=5000&max=8000&sort=price-asc
   */
  router.get("/products", async (req, res) => {
    // Catalog order = creation order (the "featured" sort keeps it for equal products).
    const docs = await ProductModel.find({ isActive: true })
      .sort({ createdAt: 1, _id: 1 })
      .lean<ProductDoc[]>();
    const filters = parseCollectionFilters(
      req.query as Record<string, string | string[] | undefined>,
    );
    res.json({ products: filterAndSortProducts(docs.map(toProduct), filters) });
  });

  router.get("/products/:slug", async (req, res) => {
    const slug = slugSchema.safeParse(req.params.slug);
    if (!slug.success) throw new HttpError(404, PRODUCT_NOT_FOUND);
    const doc = await ProductModel.findOne({ slug: slug.data, isActive: true }).lean<ProductDoc>();
    if (!doc) throw new HttpError(404, PRODUCT_NOT_FOUND);
    res.json({ product: toProduct(doc) });
  });

  router.get("/delivery-fees", async (_req, res) => {
    res.json({ deliveryFees: await loadDeliveryFees() });
  });

  return router;
}
