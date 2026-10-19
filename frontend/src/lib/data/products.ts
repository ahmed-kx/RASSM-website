import type { Product } from "@rassm/shared";
import { mockProducts } from "@rassm/shared/mocks";

// Data access for products. Today it reads the mocks from @rassm/shared; in the
// "connect" step these functions call the API instead, with the same signatures.

export async function getProducts(): Promise<Product[]> {
  return mockProducts.filter((product) => product.isActive);
}

export async function getFeaturedProducts(limit = 5): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) => product.featured).slice(0, limit);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((product) => product.slug === slug);
}

/** Up to `limit` other products, same category first, then the rest of the catalog. */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const others = (await getProducts()).filter((candidate) => candidate.id !== product.id);
  const sameCategory = others.filter((candidate) => candidate.category === product.category);
  const rest = others.filter((candidate) => candidate.category !== product.category);
  return [...sameCategory, ...rest].slice(0, limit);
}
