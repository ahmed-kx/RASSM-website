"use client";

import { MAX_QUANTITY_PER_ORDER, SIZES, sizeSchema, type Product, type Size } from "@rassm/shared";
import { useStore } from "@tanstack/react-form";
import { cn } from "@/lib/cn";
import { QuantityStepper } from "../quantity-stepper";
import { SizeGuideDialog } from "../size-guide-dialog";
import { useProductOrder } from "./product-order-provider";

const LOW_STOCK = 3;

/** Most units orderable in a size: its stock, capped by the per-order limit. */
export function getMaxQuantity(product: Pick<Product, "stock">, size: Size | null): number {
  return size ? Math.min(product.stock[size], MAX_QUANTITY_PER_ORDER) : MAX_QUANTITY_PER_ORDER;
}

/** The size held by the form, or null while none is chosen. */
export function toSize(value: string): Size | null {
  const parsed = sizeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-sm text-error">
      {message}
    </p>
  );
}

const optionLabel = "text-[11px] font-semibold tracking-label uppercase";

/** Color, size and quantity of the product page. They feed the order form below. */
export function ProductOptions() {
  const { form, product } = useProductOrder();
  const sizeValue = useStore(form.store, (state) => state.values.size);
  const size = toSize(sizeValue);
  const soldOut = SIZES.every((candidate) => product.stock[candidate] === 0);

  return (
    <div className="mt-6 space-y-6">
      <form.Field name="color">
        {(field) => {
          const error = field.state.meta.errors[0]?.message;
          return (
            <fieldset
              id="order-color"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "order-color-error" : undefined}
            >
              <legend className="sr-only">Couleur</legend>
              <p aria-hidden="true" className="flex items-baseline gap-3">
                <span className={optionLabel}>Couleur</span>
                <span className="text-sm">{field.state.value || "Choisissez une couleur"}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.colors.map((color) => {
                  const id = `color-${color.name}`;
                  return (
                    <label key={color.name} htmlFor={id} className="cursor-pointer">
                      <input
                        id={id}
                        type="radio"
                        name="color"
                        value={color.name}
                        checked={field.state.value === color.name}
                        onChange={() => field.handleChange(color.name)}
                        className="peer sr-only"
                      />
                      <span className="flex h-11 items-center gap-2.5 border border-ink/30 px-3.5 text-sm transition-colors peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink hover:border-ink">
                        <span
                          aria-hidden="true"
                          className="size-4 rounded-full border border-ink/25"
                          // The swatch color comes from the product data.
                          style={{ backgroundColor: color.hex }}
                        />
                        {color.name}
                      </span>
                    </label>
                  );
                })}
              </div>
              <FieldError id="order-color-error" message={error} />
            </fieldset>
          );
        }}
      </form.Field>

      <form.Field
        name="size"
        listeners={{
          // Keep the quantity within the stock of the new size.
          onChange: ({ value }) => {
            const max = Math.max(1, getMaxQuantity(product, toSize(value)));
            if (form.getFieldValue("quantity") > max) form.setFieldValue("quantity", max);
          },
        }}
      >
        {(field) => {
          const error = field.state.meta.errors[0]?.message;
          return (
            <fieldset
              id="order-size"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "order-size-error" : undefined}
            >
              <legend className="sr-only">Taille</legend>
              <div className="flex items-baseline justify-between">
                <p aria-hidden="true" className="flex items-baseline gap-3">
                  <span className={optionLabel}>Taille</span>
                  {field.state.value && <span className="text-sm">{field.state.value}</span>}
                </p>
                <SizeGuideDialog />
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {SIZES.map((candidate) => {
                  const unavailable = product.stock[candidate] === 0;
                  const id = `size-${candidate}`;
                  return (
                    <label
                      key={candidate}
                      htmlFor={id}
                      className={cn(!unavailable && "cursor-pointer")}
                    >
                      <input
                        id={id}
                        type="radio"
                        name="size"
                        value={candidate}
                        checked={field.state.value === candidate}
                        disabled={unavailable}
                        onChange={() => field.handleChange(candidate)}
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
              <FieldError id="order-size-error" message={error} />
              {soldOut && <p className="mt-2 text-sm text-ash">Ce produit est épuisé.</p>}
              {size && product.stock[size] <= LOW_STOCK && (
                <p className="mt-2 text-xs text-ash">Plus que {product.stock[size]} en stock</p>
              )}
            </fieldset>
          );
        }}
      </form.Field>

      <form.Field name="quantity">
        {(field) => {
          const error = field.state.meta.errors[0]?.message;
          return (
            <div id="order-quantity" aria-invalid={error ? true : undefined}>
              <p className={optionLabel} aria-hidden="true">
                Quantité
              </p>
              <QuantityStepper
                value={field.state.value}
                max={Math.max(1, getMaxQuantity(product, size))}
                onChange={field.handleChange}
                label={product.name}
                className="mt-3"
              />
              <FieldError id="order-quantity-error" message={error} />
            </div>
          );
        }}
      </form.Field>
    </div>
  );
}
