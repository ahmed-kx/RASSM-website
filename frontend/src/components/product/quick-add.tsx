"use client";

import { SIZES, type Product, type Size } from "@rassm/shared";
import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { getMaxQuantity, toCartItem, useCartStore } from "@/lib/cart/cart-store";
import { cn } from "@/lib/cn";

export type QuickAddProduct = Pick<Product, "id" | "name" | "slug" | "images" | "price" | "stock">;

/**
 * The round "+" on product cards: opens a size picker (popover from `md`, bottom sheet
 * on mobile), adds one unit of the chosen size and opens the cart.
 */
export function QuickAdd({ product, className }: { product: QuickAddProduct; className?: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);

  useEffect(() => {
    if (!open) return;
    container.current
      ?.querySelector<HTMLButtonElement>("button[data-size]:not(:disabled)")
      ?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (size: Size) => {
    const result = addItem(toCartItem(product, size, 1), getMaxQuantity(product, size));
    if (result.added === 0) {
      setMessage(`Vous avez déjà le stock maximum en taille ${size} dans votre panier.`);
      return;
    }
    setOpen(false);
    setMessage(null);
    openCart();
  };

  return (
    <div ref={container} className={cn("relative z-10", className)}>
      <button
        ref={trigger}
        type="button"
        aria-label={`Ajouter ${product.name} au panier`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMessage(null);
          setOpen((value) => !value);
        }}
        className="grid size-8 shrink-0 place-items-center rounded-full border border-ink/70 text-ink transition-colors duration-200 hover:bg-ink hover:text-paper focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <PlusIcon />
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-ink/40 motion-safe:animate-fade-in md:hidden"
          />
          <div
            role="dialog"
            aria-labelledby={titleId}
            className="fixed inset-x-0 bottom-0 z-50 bg-bone p-5 text-ink shadow-2xl motion-safe:animate-slide-in-up md:absolute md:inset-x-auto md:right-0 md:bottom-11 md:w-64 md:border md:border-line md:p-4 md:shadow-lg md:motion-safe:animate-fade-in"
          >
            <div className="flex items-start justify-between gap-3">
              <p id={titleId} className="text-[11px] font-semibold tracking-button uppercase">
                Choisir une taille
                <span className="mt-1 block font-normal tracking-normal text-ash normal-case">
                  {product.name}
                </span>
              </p>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
                className="-mt-2 -mr-2 grid size-9 place-items-center hover:opacity-70 md:hidden"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {SIZES.map((size) => {
                const soldOut = product.stock[size] === 0;
                return (
                  <button
                    key={size}
                    type="button"
                    data-size={size}
                    disabled={soldOut}
                    onClick={() => choose(size)}
                    aria-label={soldOut ? `Taille ${size}, épuisée` : `Taille ${size}`}
                    className={cn(
                      "h-11 border text-xs transition-colors md:h-9",
                      soldOut
                        ? "cursor-not-allowed border-line text-stone line-through"
                        : "border-ink/40 hover:border-ink hover:bg-ink hover:text-paper focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink",
                    )}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
            {message && (
              <p role="alert" className="mt-3 text-xs text-error">
                {message}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
