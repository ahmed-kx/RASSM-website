/** Dashboard URLs. Never linked from the public site. */
export const adminRoutes = {
  home: "/admin",
  login: "/admin/connexion",
  orders: "/admin/commandes",
  order: (id: string) => `/admin/commandes/${id}`,
  blacklist: "/admin/liste-noire",
  products: "/admin/produits",
  newProduct: "/admin/produits/nouveau",
  product: (id: string) => `/admin/produits/${id}`,
  delivery: "/admin/livraison",
  messages: "/admin/messages",
  subscribers: "/admin/abonnes",
} as const;
