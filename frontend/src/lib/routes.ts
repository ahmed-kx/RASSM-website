import type { Category } from "@rassm/shared";

/** Every internal URL in one place. Every route here exists. */
export const routes = {
  home: "/",
  collection: "/collection",
  category: (category: Category) => `/collection?category=${category}`,
  product: (slug: string) => `/collection/${slug}`,
  about: "/a-propos",
  contact: "/contact",
  /** Thank-you page after an order ("commande reçue"). It carries no order number. */
  orderReceived: "/merci",
  delivery: "/livraison",
  exchanges: "/echanges",
  sizeGuide: "/guide-des-tailles",
  faq: "/faq",
} as const;
