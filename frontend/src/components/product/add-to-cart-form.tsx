"use client";

import { MAX_QUANTITY_PER_ITEM, SIZES, type Product, type Size } from "@rassm/shared";
import { useRef, useState } from "react";
import { QuantityStepper } from "@/components/cart/quantity-stepper";
import { Button } from "@/components/ui/button";
import { getMaxQuantity, toCartItem, useCartStore } from "@/lib/cart/cart-store";
import { cn } from "@/lib/cn";
import { SizeGuideDialog } from "./size-guide-dialog";

const LOW_STOCK = 3;

/** Size, quantity and "Ajouter au panier" on the product page. */
export function AddToCartForm({ product }: { product: Product }) {
  const [size, setSize] = useState<Size | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const sizeGroup = useRef<HTMLFieldSetElement>(null);
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const inCart = useCartStore((state) =>
    size
      ? (state.items.find((item) => item.productId === product.id && item.size === size)
          ?.quantity ?? 0)
      : 0,
  );

  const max = size ? getMaxQuantity(product, size) : MAX_QUANTITY_PER_ITEM;
  // What can still be added, given what is already in the cart.
  const remaining = Math.max(max - inCart, 0);
  const stock = size ? product.stock[size] : null;
  const soldOut = SIZES.every((candidate) => product.stock[candidate] === 0);

  const chooseSize = (next: Size) => {
    setSize(next);
    setError(null);
    const nextRemaining = getMaxQuantity(product, next);
    setQuantity((current) => Math.max(1, Math.min(current, nextRemaining)));
  };

  const submit = () => {
    if (!size) {
      setError("Veuillez choisir une taille.");
      sizeGroup.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
      return;
    }
    if (remaining === 0) {
      setError("Vous avez déjà le stock maximum de cette taille dans votre panier.");
      return;
    }
    addItem(toCartItem(product, size, Math.min(quantity, remaining)), max);
    setQuantity(1);
    openCart();
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="mt-8"
    >
      <fieldset
        ref={sizeGroup}
        aria-describedby={error ? "add-to-cart-error" : undefined}
        aria-invalid={error && !size ? true : undefined}
      >
        <legend className="sr-only">Taille</legend>
        <div className="flex items-baseline justify-between">
          <p aria-hidden="true" className="flex items-baseline gap-3">
            <span className="text-[11px] font-semibold tracking-label uppercase">Taille</span>
            {size && <span className="text-sm">{size}</span>}
          </p>
          <SizeGuideDialog />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {SIZES.map((candidate) => {
            const unavailable = product.stock[candidate] === 0;
            const id = `size-${candidate}`;
            return (
              <label key={candidate} htmlFor={id} className={cn(!unavailable && "cursor-pointer")}>
                <input
                  id={id}
                  type="radio"
                  name="size"
                  value={candidate}
                  checked={size === candidate}
                  disabled={unavailable}
                  onChange={() => chooseSize(candidate)}
                  aria-label={unavailable ? `${candidate}, épuisé` : candidate}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-11 place-items-center border text-sm transition-colors peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
                    unavailable
                      ? "border-line bg-[linear-gradient(to_top_right,transparent_calc(50%-0.5px),var(--color-line)_50%,transparent_calc(50%+0.5px))] text-stone line-through"
                      : "border-ink/30 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper hover:border-ink",
                  )}
                >
                  {candidate}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-3 min-h-5 text-xs text-ash" aria-live="polite">
        {stock !== null && stock > 0 && stock <= LOW_STOCK && `Plus que ${stock} en stock`}
        {size && inCart > 0 && (
          <span className="block">
            Déjà {inCart} dans votre panier
            {remaining === 0 ? " (stock maximum atteint)." : "."}
          </span>
        )}
      </p>

      <div className="mt-4 flex items-stretch gap-3">
        <QuantityStepper
          value={quantity}
          max={Math.max(1, remaining)}
          onChange={setQuantity}
          label={product.name}
          className="shrink-0"
        />
        <Button
          type="submit"
          surface="light"
          disabled={soldOut}
          className="flex-1 disabled:opacity-50"
        >
          {soldOut ? "Épuisé" : "Ajouter au panier"}
        </Button>
      </div>

      {error && (
        <p id="add-to-cart-error" role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}
    </form>
  );
}
