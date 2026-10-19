import {
  MAX_QUANTITY_PER_ITEM,
  cartItemSchema,
  type CartItem,
  type Product,
  type Size,
} from "@rassm/shared";
import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Most units of one size a customer can have in the cart: its stock, capped at 10. */
export function getMaxQuantity(product: Pick<Product, "stock">, size: Size): number {
  return Math.min(product.stock[size], MAX_QUANTITY_PER_ITEM);
}

/** Builds the cart line for a product and size (price, name and image are snapshots). */
export function toCartItem(
  product: Pick<Product, "id" | "name" | "slug" | "images" | "price">,
  size: Size,
  quantity: number,
): CartItem {
  return {
    productId: product.id,
    name: product.name,
    slug: product.slug,
    image: product.images[0] ?? "",
    size,
    quantity,
    unitPrice: product.price,
  };
}

export interface AddToCartResult {
  /** Units actually added (0 when the stock limit was already reached). */
  added: number;
  /** True when the request was reduced to stay within the stock. */
  limited: boolean;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  /** False until the saved cart is read from localStorage (always false on the server). */
  hasHydrated: boolean;
  addItem: (item: CartItem, maxQuantity: number) => AddToCartResult;
  setQuantity: (productId: string, size: Size, quantity: number, maxQuantity: number) => void;
  removeItem: (productId: string, size: Size) => void;
  /** Drops products that no longer exist and refreshes snapshots and stock limits. */
  syncWithCatalog: (products: readonly Product[]) => void;
  openCart: () => void;
  closeCart: () => void;
}

const sameLine = (item: CartItem, productId: string, size: Size) =>
  item.productId === productId && item.size === size;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      hasHydrated: false,

      addItem: (item, maxQuantity) => {
        const existing = get().items.find((line) => sameLine(line, item.productId, item.size));
        const current = existing?.quantity ?? 0;
        const target = Math.min(current + item.quantity, maxQuantity);
        const added = Math.max(target - current, 0);
        if (added > 0) {
          set({
            items: existing
              ? get().items.map((line) =>
                  sameLine(line, item.productId, item.size) ? { ...line, quantity: target } : line,
                )
              : [...get().items, { ...item, quantity: target }],
          });
        }
        return { added, limited: added < item.quantity };
      },

      setQuantity: (productId, size, quantity, maxQuantity) =>
        set({
          items: get().items.map((line) =>
            sameLine(line, productId, size)
              ? { ...line, quantity: Math.max(1, Math.min(quantity, maxQuantity)) }
              : line,
          ),
        }),

      removeItem: (productId, size) =>
        set({ items: get().items.filter((line) => !sameLine(line, productId, size)) }),

      syncWithCatalog: (products) =>
        set({
          items: get().items.flatMap((line) => {
            const product = products.find((candidate) => candidate.id === line.productId);
            if (!product || !product.isActive) return [];
            const max = getMaxQuantity(product, line.size);
            if (max === 0) return [];
            return [{ ...toCartItem(product, line.size, Math.min(line.quantity, max)) }];
          }),
        }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
    }),
    {
      name: "rassm-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Rehydrated by <CartProvider> after mount, so server and first client render match.
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
      // Never trust localStorage: keep only valid lines.
      merge: (persisted, current) => {
        const parsed = z.object({ items: z.array(cartItemSchema) }).safeParse(persisted);
        return { ...current, items: parsed.success ? parsed.data.items : [] };
      },
      onRehydrateStorage: () => () => {
        useCartStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** Number of units in the cart; 0 until the saved cart is loaded (no hydration mismatch). */
export function useCartCount(): number {
  return useCartStore((state) =>
    state.hasHydrated ? state.items.reduce((sum, item) => sum + item.quantity, 0) : 0,
  );
}
