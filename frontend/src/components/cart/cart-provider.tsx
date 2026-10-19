"use client";

import type { Product } from "@rassm/shared";
import { createContext, use, useEffect, type ReactNode } from "react";
import { useCartStore } from "@/lib/cart/cart-store";
import { CartDrawer } from "./cart-drawer";

const CatalogContext = createContext<readonly Product[]>([]);

/** Products known to the cart (stock limits, delivery tiers). Comes from the data layer. */
export function useCatalog(): readonly Product[] {
  return use(CatalogContext);
}

/**
 * Loads the saved cart after mount, keeps it in sync with the catalog and with other
 * tabs, and renders the cart drawer.
 */
export function CartProvider({
  products,
  children,
}: {
  products: readonly Product[];
  children: ReactNode;
}) {
  const hasHydrated = useCartStore((state) => state.hasHydrated);

  useEffect(() => {
    void useCartStore.persist.rehydrate();
    const onStorage = (event: StorageEvent) => {
      if (event.key === useCartStore.persist.getOptions().name) {
        void useCartStore.persist.rehydrate();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (hasHydrated) useCartStore.getState().syncWithCatalog(products);
  }, [hasHydrated, products]);

  return (
    <CatalogContext value={products}>
      {children}
      <CartDrawer />
    </CatalogContext>
  );
}
