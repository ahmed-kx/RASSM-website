import { API_PATHS, productSchema, type Product } from "@rassm/shared";
import { z } from "zod";
import { apiGet } from "@/lib/api";

// Data access for products, from the API. Pages are server-rendered with a short cache,
// so stock and prices stay fresh; the API checks the stock again on every order.

/** Seconds Next keeps a product response before asking the API again. */
const PRODUCTS_REVALIDATE = 30;

const productListSchema = z.object({ products: z.array(productSchema) });
const productResponseSchema = z.object({ product: productSchema });

/** Products on sale, in catalog order (featured first). */
export async function getProducts(): Promise<Product[]> {
  const data = await apiGet(API_PATHS.products, productListSchema, {
    revalidate: PRODUCTS_REVALIDATE,
  });
  return data?.products ?? [];
}

export async function getFeaturedProducts(limit = 5): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) => product.featured).slice(0, limit);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const data = await apiGet(API_PATHS.product(slug), productResponseSchema, {
    revalidate: PRODUCTS_REVALIDATE,
  });
  return data?.product;
}
