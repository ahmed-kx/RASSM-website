import type { Category } from "@rassm/shared";

/** Every internal URL in one place. Pages that do not exist yet are built in later steps. */
export const routes = {
  home: "/",
  collection: "/collection",
  category: (category: Category) => `/collection?category=${category}`,
  product: (slug: string) => `/collection/${slug}`,
  lookbook: "/lookbook",
  about: "/a-propos",
  contact: "/contact",
  search: "/recherche",
  /** Thank-you page after an order, with the order number. */
  orderConfirmation: (orderNumber: string) => `/merci?commande=${encodeURIComponent(orderNumber)}`,
  delivery: "/livraison",
  /** Exchange policy (page built later). */
  exchanges: "/echanges",
  sizeGuide: "/guide-des-tailles",
  faq: "/faq",
} as const;
