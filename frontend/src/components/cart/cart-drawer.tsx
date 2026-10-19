"use client";

import { formatPrice, getCartSubtotal, type CartItem } from "@rassm/shared";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";
import { getMaxQuantity, useCartStore } from "@/lib/cart/cart-store";
import { routes } from "@/lib/routes";
import { useCatalog } from "./cart-provider";
import { DeliveryProgress } from "./delivery-progress";
import { QuantityStepper } from "./quantity-stepper";

/** Slide-in cart panel, opened from the header or after "Ajouter au panier". */
export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  return isOpen ? <CartDrawerPanel /> : null;
}

function CartDrawerPanel() {
  const items = useCartStore((state) => state.items);
  const closeCart = useCartStore((state) => state.closeCart);
  const closeButton = useRef<HTMLButtonElement>(null);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [closeCart]);

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={closeCart}
        className="absolute inset-0 bg-ink/50 motion-safe:animate-fade-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-bone text-ink shadow-2xl motion-safe:animate-slide-in-right"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <h2 id="cart-title" className="text-[11px] font-semibold tracking-wide-label uppercase">
            Votre panier {count > 0 && `(${count})`}
          </h2>
          <button
            ref={closeButton}
            type="button"
            aria-label="Fermer le panier"
            onClick={closeCart}
            className="grid size-10 place-items-center hover:opacity-70 focus-visible:outline-1 focus-visible:outline-ink"
          >
            <CloseIcon />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <p className="font-display text-3xl uppercase">Votre panier est vide</p>
            <p className="mt-3 text-sm text-ash">
              Découvrez la collection et trouvez la pièce qui vous ressemble.
            </p>
            <Button
              href={routes.collection}
              onClick={closeCart}
              surface="light"
              withArrow
              className="mt-8"
            >
              Voir la collection
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {items.map((item) => (
                <CartLine key={`${item.productId}-${item.size}`} item={item} />
              ))}
            </ul>
            <CartFooter items={items} onClose={closeCart} />
          </>
        )}
      </div>
    </div>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const catalog = useCatalog();
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const closeCart = useCartStore((state) => state.closeCart);
  const product = catalog.find((candidate) => candidate.id === item.productId);
  const max = product ? getMaxQuantity(product, item.size) : item.quantity;

  return (
    <li className="flex gap-4 py-5">
      <Link
        href={routes.product(item.slug)}
        onClick={closeCart}
        className="relative size-24 shrink-0 overflow-hidden bg-cream"
      >
        {item.image && (
          <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-button uppercase">{item.name}</p>
            <p className="mt-1 text-xs text-ash">Taille : {item.size}</p>
          </div>
          <p className="shrink-0 text-sm">{formatPrice(item.unitPrice * item.quantity)}</p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <QuantityStepper
            value={item.quantity}
            max={max}
            onChange={(quantity) => setQuantity(item.productId, item.size, quantity, max)}
            label={`${item.name}, taille ${item.size}`}
          />
          <button
            type="button"
            onClick={() => removeItem(item.productId, item.size)}
            className="text-xs text-ash underline underline-offset-4 hover:text-ink"
          >
            Retirer
            <span className="sr-only">
              {" "}
              {item.name}, taille {item.size}
            </span>
          </button>
        </div>
        {item.quantity >= max && (
          <p className="mt-2 text-xs text-stone">Quantité maximale disponible.</p>
        )}
      </div>
    </li>
  );
}

function CartFooter({ items, onClose }: { items: readonly CartItem[]; onClose: () => void }) {
  const catalog = useCatalog();
  return (
    <div className="shrink-0 space-y-4 border-t border-line px-5 py-5">
      <DeliveryProgress items={items} products={catalog} />
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold tracking-label uppercase">Sous-total</p>
        <p className="text-base">{formatPrice(getCartSubtotal(items))}</p>
      </div>
      <p className="text-xs text-stone">
        Frais de livraison calculés à la commande selon votre wilaya. Paiement à la livraison.
      </p>
      <div className="grid gap-3">
        <Button href={routes.checkout} onClick={onClose} surface="light" withArrow>
          Commander
        </Button>
        <Button variant="outlined" surface="light" onClick={onClose}>
          Continuer mes achats
        </Button>
      </div>
    </div>
  );
}
