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
  message: (id: string) => `/admin/messages/${id}`,
  subscribers: "/admin/abonnes",
  clients: "/admin/clients",
  client: (phone: string) => `/admin/clients/${encodeURIComponent(phone)}`,
  ads: "/admin/publicite",
  settings: "/admin/parametres",
} as const;
