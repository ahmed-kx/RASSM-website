import {
  PRODUCT_IMAGE_MAX_BYTES,
  adminProductFlagsSchema,
  adminProductQuerySchema,
  adminSettingsUpdateSchema,
  adminStockUpdateSchema,
  deliveryBulkSchema,
  deliveryFeeUpdateSchema,
  imageUrlSchema,
  wilayaCodeSchema,
} from "@rassm/shared";
import type { RequestHandler, Router } from "express";
import multer from "multer";
import { z } from "zod";
import { HttpError, parseOrThrow } from "../lib/http-error";
import { InvalidImageError, stripImageMetadata } from "../lib/image-metadata";
import { describeError, logger } from "../lib/logger";
import type { Revalidator } from "../lib/revalidate";
import { loadSettings, saveSettings } from "../models/setting";
import {
  bulkUpdateDeliveryFees,
  listDeliveryFees,
  updateDeliveryFee,
} from "../services/admin-delivery";
import {
  createProduct,
  deleteProduct,
  deleteUnusedImages,
  duplicateProduct,
  getProductDetail,
  listProducts,
  setProductFlags,
  updateProduct,
  updateStock,
} from "../services/admin-products";
import { detectImageType, type ImageStorage } from "../services/image-storage";

export interface CatalogRouteOptions {
  revalidator: Revalidator;
  /** Null when the Cloudinary keys are not set: uploads answer 503. */
  imageStorage: ImageStorage | null;
  /** Stricter limit for the photo uploads. */
  sensitiveLimiter: () => RequestHandler;
}

const STORAGE_OFF =
  "Le stockage des photos n'est pas configuré (clés Cloudinary manquantes dans backend/.env).";
const TOO_BIG = `La photo dépasse ${PRODUCT_IMAGE_MAX_BYTES / 1024 / 1024} Mo. Choisissez une photo plus légère.`;
const BAD_FORMAT = "Format non accepté : photo JPG, PNG ou WebP uniquement.";

const saveSchema = z.object({ product: z.unknown(), updatedAt: z.iso.datetime().optional() });
const dryRunOf = (query: unknown) => (query as Record<string, unknown>).apercu === "1";

/** Products, photos and delivery prices of the dashboard (session already checked). */
export function addCatalogRoutes(router: Router, options: CatalogRouteOptions): void {
  const services = { revalidator: options.revalidator, imageStorage: options.imageStorage };

  // ---------- Settings ----------

  router.get("/settings", async (_req, res) => {
    res.json(await loadSettings());
  });

  router.put("/settings", async (req, res) => {
    res.json(await saveSettings(parseOrThrow(adminSettingsUpdateSchema, req.body)));
  });

  // ---------- Products ----------

  router.get("/products", async (req, res) => {
    res.json(await listProducts(adminProductQuerySchema.parse(req.query)));
  });

  router.post("/products", async (req, res) => {
    const { product } = parseOrThrow(saveSchema, req.body);
    res.status(201).json(await createProduct(product, services));
  });

  router.get("/products/:id", async (req, res) => {
    res.json(await getProductDetail(req.params.id));
  });

  router.put("/products/:id", async (req, res) => {
    const { product, updatedAt } = parseOrThrow(saveSchema, req.body);
    res.json(await updateProduct(req.params.id, product, updatedAt, services));
  });

  router.patch("/products/:id/stock", async (req, res) => {
    res.json(
      await updateStock(req.params.id, parseOrThrow(adminStockUpdateSchema, req.body), services),
    );
  });

  router.patch("/products/:id/flags", async (req, res) => {
    res.json(
      await setProductFlags(
        req.params.id,
        parseOrThrow(adminProductFlagsSchema, req.body),
        services,
      ),
    );
  });

  router.post("/products/:id/duplicate", async (req, res) => {
    res.status(201).json(await duplicateProduct(req.params.id, services));
  });

  router.delete("/products/:id", async (req, res) => {
    await deleteProduct(req.params.id, services);
    res.json({ ok: true });
  });

  // ---------- Photos ----------

  const receiveImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES, files: 1, fields: 0 },
  }).single("image");
  const receive: RequestHandler = (req, res, next) => {
    if (!options.imageStorage) {
      next(new HttpError(503, STORAGE_OFF));
      return;
    }
    receiveImage(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(
          error.code === "LIMIT_FILE_SIZE"
            ? new HttpError(413, TOO_BIG)
            : new HttpError(400, "Envoyez une seule photo à la fois."),
        );
        return;
      }
      next(error);
    });
  };

  router.post("/uploads", options.sensitiveLimiter(), receive, async (req, res) => {
    const storage = options.imageStorage;
    if (!storage) throw new HttpError(503, STORAGE_OFF);
    if (!req.file) throw new HttpError(400, "Choisissez une photo.");
    // The real type comes from the bytes (the name and declared type can lie).
    const type = detectImageType(req.file.buffer);
    if (!type) throw new HttpError(415, BAD_FORMAT);
    // GPS position, camera, date… removed before the photo leaves the server.
    let photo: Buffer;
    try {
      photo = stripImageMetadata(req.file.buffer, type);
    } catch (error) {
      if (error instanceof InvalidImageError) throw new HttpError(415, BAD_FORMAT);
      throw error;
    }
    try {
      res.status(201).json({ image: await storage.upload(photo) });
    } catch (error) {
      logger.error("Photo upload failed", describeError(error));
      throw new HttpError(502, "L'envoi de la photo a échoué. Réessayez dans un instant.");
    }
  });

  /** A photo removed in the form before saving: deleted unless a product or an order uses it. */
  router.delete("/uploads", async (req, res) => {
    const { url } = parseOrThrow(z.object({ url: imageUrlSchema }), req.body);
    await deleteUnusedImages([url], options.imageStorage);
    res.json({ ok: true });
  });

  // ---------- Delivery prices ----------

  router.get("/delivery-fees", async (_req, res) => {
    res.json(await listDeliveryFees());
  });

  router.post("/delivery-fees/bulk", async (req, res) => {
    res.json(
      await bulkUpdateDeliveryFees(parseOrThrow(deliveryBulkSchema, req.body), {
        dryRun: dryRunOf(req.query),
        revalidator: options.revalidator,
      }),
    );
  });

  router.put("/delivery-fees/:code", async (req, res) => {
    const code = wilayaCodeSchema.safeParse(Number(req.params.code));
    if (!code.success) throw new HttpError(404, "Wilaya introuvable.");
    res.json(
      await updateDeliveryFee(code.data, parseOrThrow(deliveryFeeUpdateSchema, req.body), {
        dryRun: dryRunOf(req.query),
        revalidator: options.revalidator,
      }),
    );
  });
}
