import {
  PRODUCT_TABS,
  SIZES,
  createAdminProductInputSchema,
  getMaxHomeDeliveryPrice,
  getProductStatus,
  getTotalStock,
  productImagesOf,
  slugify,
  type AdminProductDetail,
  type AdminProductFlags,
  type AdminProductList,
  type AdminProductRow,
  type AdminStockUpdate,
  type Kpi,
  type Product,
  type ProductTab,
  type adminProductQuerySchema,
} from "@rassm/shared";
import type { z } from "zod";
import { HttpError, parseOrThrow } from "../lib/http-error";
import { describeError, logger } from "../lib/logger";
import type { Revalidator } from "../lib/revalidate";
import { loadDeliveryFees } from "../models/delivery-fee";
import { OrderModel, REAL_ORDERS } from "../models/order";
import { loadSettings } from "../models/setting";
import {
  ProductModel,
  isDuplicateKey,
  nextSku,
  toProduct,
  type ProductDoc,
} from "../models/product";
import type { ImageStorage } from "./image-storage";

// Dashboard products: list (filters, KPIs), create, edit, stock grid, switches, duplicate,
// delete. Every change refreshes the website's product pages.

const NOT_FOUND = "Produit introuvable.";
const CHANGED =
  "Ce produit a changé entre-temps (une commande vient peut-être d'être passée). Rechargez la page pour voir le stock à jour.";
const SLUG_TAKEN = "Ce slug est déjà utilisé par un autre produit.";

export interface ProductServices {
  revalidator: Revalidator;
  imageStorage: ImageStorage | null;
}

type ProductQuery = z.output<typeof adminProductQuerySchema>;

/** Accent- and case-insensitive text for the search. */
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function orderCounts(): Promise<Map<string, number>> {
  const rows = await OrderModel.aggregate<{ _id: string; count: number }>([
    { $match: REAL_ORDERS },
    { $group: { _id: "$item.productId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.count]));
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * A count now against 30 days ago, from creation dates (one point per day for the
 * sparkline). Null when there was nothing 30 days ago: no percentage can be computed.
 */
function countTrend(dates: readonly Date[], now: number): Kpi["trend"] {
  const series: number[] = [];
  for (let day = 30; day >= 0; day -= 1) {
    const at = now - day * DAY;
    series.push(dates.filter((date) => date.getTime() <= at).length);
  }
  const before = series[0] ?? 0;
  const current = series.at(-1) ?? 0;
  if (before === 0) return null;
  return { percent: Math.round(((current - before) / before) * 1000) / 10, series };
}

function computeKpis(products: readonly Product[], now: number): AdminProductList["kpis"] {
  const firstByDrop = new Map<string, Date>();
  for (const product of products) {
    const created = new Date(product.createdAt);
    const known = firstByDrop.get(product.drop);
    if (!known || created < known) firstByDrop.set(product.drop, created);
  }
  return {
    products: {
      value: products.length,
      trend: countTrend(
        products.map((product) => new Date(product.createdAt)),
        now,
      ),
    },
    drops: { value: firstByDrop.size, trend: countTrend([...firstByDrop.values()], now) },
    // No stock history is kept: no trend.
    stockUnits: { value: products.reduce((sum, p) => sum + getTotalStock(p), 0), trend: null },
    stockValue: {
      value: products.reduce((sum, p) => sum + getTotalStock(p) * p.price, 0),
      trend: null,
    },
  };
}

const SORTERS: Record<ProductQuery["sort"], (a: AdminProductRow, b: AdminProductRow) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  name: (a, b) => a.name.localeCompare(b.name, "fr"),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  "stock-asc": (a, b) => a.stockTotal - b.stockTotal,
  "stock-desc": (a, b) => b.stockTotal - a.stockTotal,
};

export async function listProducts(
  query: ProductQuery,
  now = Date.now(),
): Promise<AdminProductList> {
  const [docs, counts, { lowStockThreshold }] = await Promise.all([
    ProductModel.find().lean<ProductDoc[]>(),
    orderCounts(),
    loadSettings(),
  ]);
  const products = docs.map(toProduct);
  const costs = new Map(docs.map((doc) => [doc._id, doc.costPrice ?? null]));
  const rows: AdminProductRow[] = products.map((product) => ({
    ...product,
    // Every product gets one at startup (ensureProductSkus).
    sku: product.sku ?? "",
    costPrice: costs.get(product.id) ?? null,
    stockTotal: getTotalStock(product),
    status: getProductStatus(product, lowStockThreshold),
    orderCount: counts.get(product.id) ?? 0,
  }));

  const q = query.q ? fold(query.q) : "";
  const matches = (row: AdminProductRow) =>
    (!q || [row.name, row.sku, row.slug, row.drop].some((text) => fold(text).includes(q))) &&
    (query.status === "all" || row.status === query.status) &&
    (!query.drop || row.drop === query.drop);
  const filtered = rows.filter(matches);

  const tabCounts = Object.fromEntries(
    PRODUCT_TABS.map((tab) => [
      tab,
      tab === "all" ? filtered.length : filtered.filter((row) => row.category === tab).length,
    ]),
  ) as Record<ProductTab, number>;

  const inTab = filtered
    .filter((row) => query.category === "all" || row.category === query.category)
    .sort(SORTERS[query.sort]);
  const start = (query.page - 1) * query.limit;

  return {
    products: inTab.slice(start, start + query.limit),
    total: inTab.length,
    counts: tabCounts,
    drops: [...new Set(products.map((product) => product.drop))].sort(),
    lowStockThreshold,
    kpis: computeKpis(products, now),
  };
}

async function loadDoc(id: string): Promise<ProductDoc> {
  const doc = await ProductModel.findById(id).lean<ProductDoc>();
  if (!doc) throw new HttpError(404, NOT_FOUND);
  return doc;
}

const detailOf = async (doc: ProductDoc): Promise<AdminProductDetail> => ({
  product: toProduct(doc),
  costPrice: doc.costPrice ?? null,
  orderCount: await OrderModel.countDocuments({ "item.productId": doc._id }),
  updatedAt: (doc.updatedAt ?? doc.createdAt).toISOString(),
});

export async function getProductDetail(id: string): Promise<AdminProductDetail> {
  return detailOf(await loadDoc(id));
}

/** Validates the form with the tier limit of the current fee table. */
async function parseInput(input: unknown) {
  const maxHome = getMaxHomeDeliveryPrice(await loadDeliveryFees());
  return parseOrThrow(createAdminProductInputSchema(maxHome), input);
}

async function nextProductId(): Promise<string> {
  const docs = await ProductModel.find({ _id: { $regex: /^prod_\d+$/ } }, { _id: 1 }).lean<
    { _id: string }[]
  >();
  const last = Math.max(0, ...docs.map((doc) => Number(doc._id.slice(5))));
  return `prod_${String(last + 1).padStart(3, "0")}`;
}

/** Inserts a new product with a fresh id and SKU (retried if another one took them). */
async function insertProduct(fields: Omit<ProductDoc, "_id" | "sku" | "createdAt">) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const created = await ProductModel.create({
        ...fields,
        _id: await nextProductId(),
        sku: await nextSku(fields.category),
        createdAt: new Date(),
      });
      return created.toObject<ProductDoc>();
    } catch (error) {
      if (!isDuplicateKey(error) || attempt >= 4) throw error;
      if (/slug/.test(String((error as Error).message))) {
        throw new HttpError(409, SLUG_TAKEN, { slug: SLUG_TAKEN });
      }
    }
  }
}

export async function createProduct(
  body: unknown,
  services: ProductServices,
): Promise<AdminProductDetail> {
  const input = await parseInput(body);
  if (await ProductModel.exists({ slug: input.slug })) {
    throw new HttpError(409, SLUG_TAKEN, { slug: SLUG_TAKEN });
  }
  const doc = await insertProduct({
    ...input,
    costPrice: input.costPrice ?? null,
    images: productImagesOf(input),
  });
  logger.info("Product created", { id: doc._id, sku: doc.sku });
  services.revalidator.revalidate(["products"]);
  return detailOf(doc);
}

const imagesOf = (product: Pick<ProductDoc, "images" | "colors">) => [
  ...product.images,
  ...product.colors.flatMap((color) => color.images ?? []),
];

/**
 * Deletes photos from the storage once nothing uses them any more: no product (a duplicate
 * shares its photos) and no order (orders keep the photo of what was bought).
 */
export async function deleteUnusedImages(
  urls: readonly string[],
  storage: ImageStorage | null,
): Promise<void> {
  if (!storage) return;
  for (const url of new Set(urls)) {
    if (!storage.owns(url)) continue;
    const used =
      (await ProductModel.exists({ $or: [{ images: url }, { "colors.images": url }] })) ??
      (await OrderModel.exists({ "item.image": url }));
    if (used) continue;
    await storage
      .remove(url)
      .catch((error: unknown) =>
        logger.error("Photo not deleted", { url, ...describeError(error) }),
      );
  }
}

export async function updateProduct(
  id: string,
  body: unknown,
  expectedUpdatedAt: string | undefined,
  services: ProductServices,
): Promise<AdminProductDetail> {
  const doc = await loadDoc(id);
  const input = await parseInput(body);
  const current = (doc.updatedAt ?? doc.createdAt).toISOString();
  if (expectedUpdatedAt && expectedUpdatedAt !== current) throw new HttpError(409, CHANGED);
  if (await ProductModel.exists({ slug: input.slug, _id: { $ne: id } })) {
    throw new HttpError(409, SLUG_TAKEN, { slug: SLUG_TAKEN });
  }

  // Only if nothing changed since it was read (an order may have taken stock meanwhile).
  const updated = await ProductModel.findOneAndUpdate(
    { _id: id, updatedAt: doc.updatedAt ?? null },
    { $set: { ...input, costPrice: input.costPrice ?? null, images: productImagesOf(input) } },
    { returnDocument: "after", runValidators: true },
  ).lean<ProductDoc>();
  if (!updated) throw new HttpError(409, CHANGED);

  const kept = new Set(imagesOf(updated));
  await deleteUnusedImages(
    imagesOf(doc).filter((url) => !kept.has(url)),
    services.imageStorage,
  );
  logger.info("Product updated", { id, sku: updated.sku });
  services.revalidator.revalidate(["products"]);
  return detailOf(updated);
}

/** Quick stock edit: the grid of every color (other fields unchanged). */
export async function updateStock(
  id: string,
  update: AdminStockUpdate,
  services: ProductServices,
): Promise<AdminProductDetail> {
  const doc = await loadDoc(id);
  const current = (doc.updatedAt ?? doc.createdAt).toISOString();
  if (update.updatedAt && update.updatedAt !== current) throw new HttpError(409, CHANGED);
  const colors = doc.colors.map((color) => {
    const next = update.colors.find((entry) => entry.name === color.name);
    return next ? { ...color, stock: next.stock } : color;
  });
  const unknown = update.colors.find(
    (entry) => !doc.colors.some((color) => color.name === entry.name),
  );
  if (unknown) throw new HttpError(400, `Couleur inconnue : ${unknown.name}.`);

  const updated = await ProductModel.findOneAndUpdate(
    { _id: id, updatedAt: doc.updatedAt ?? null },
    { $set: { colors } },
    { returnDocument: "after", runValidators: true },
  ).lean<ProductDoc>();
  if (!updated) throw new HttpError(409, CHANGED);
  services.revalidator.revalidate(["products"]);
  return detailOf(updated);
}

/** "Visible sur le site" and "Mis en avant". */
export async function setProductFlags(
  id: string,
  flags: AdminProductFlags,
  services: ProductServices,
): Promise<AdminProductDetail> {
  const updated = await ProductModel.findByIdAndUpdate(
    id,
    { $set: flags },
    { returnDocument: "after" },
  ).lean<ProductDoc>();
  if (!updated) throw new HttpError(404, NOT_FOUND);
  services.revalidator.revalidate(["products"]);
  return detailOf(updated);
}

/** A free slug: "<slug>-copie", then "-copie-2", "-copie-3"… */
async function freeCopySlug(slug: string): Promise<string> {
  const base = `${slugify(slug)
    .replace(/-copie(-\d+)?$/, "")
    .slice(0, 70)}-copie`;
  for (let index = 1; ; index += 1) {
    const candidate = index === 1 ? base : `${base}-${index}`;
    if (!(await ProductModel.exists({ slug: candidate }))) return candidate;
  }
}

/** Hidden copy, "(copie)" in the name, new slug and SKU, stock at 0 (the photos are shared). */
export async function duplicateProduct(
  id: string,
  services: ProductServices,
): Promise<AdminProductDetail> {
  const doc = await loadDoc(id);
  const name = `${doc.name.replace(/ \(copie\)$/, "").slice(0, 72)} (copie)`;
  const copy = await insertProduct({
    name,
    slug: await freeCopySlug(doc.slug),
    description: doc.description,
    category: doc.category,
    price: doc.price,
    costPrice: doc.costPrice ?? null,
    images: [...doc.images],
    colors: doc.colors.map((color) => ({
      name: color.name,
      hex: color.hex,
      ...(color.images?.length ? { images: [...color.images] } : {}),
      stock: Object.fromEntries(
        SIZES.map((size) => [size, 0]),
      ) as ProductDoc["colors"][number]["stock"],
    })),
    featured: false,
    isActive: false,
    deliveryDiscountTiers: doc.deliveryDiscountTiers.map((tier) => ({ ...tier })),
    drop: doc.drop,
  });
  logger.info("Product duplicated", { from: id, id: copy._id, sku: copy.sku });
  services.revalidator.revalidate(["products"]);
  return detailOf(copy);
}

/** Only a product without orders can be deleted (otherwise: hide it). Its photos go too. */
export async function deleteProduct(id: string, services: ProductServices): Promise<void> {
  const doc = await loadDoc(id);
  const orders = await OrderModel.countDocuments({ "item.productId": id });
  if (orders > 0) {
    throw new HttpError(
      409,
      `Ce produit a ${orders} commande${orders > 1 ? "s" : ""} : il ne peut pas être supprimé, seulement masqué (les commandes gardent ainsi leurs informations).`,
    );
  }
  await ProductModel.deleteOne({ _id: id });
  await deleteUnusedImages(imagesOf(doc), services.imageStorage);
  logger.info("Product deleted", { id, sku: doc.sku });
  services.revalidator.revalidate(["products"]);
}
