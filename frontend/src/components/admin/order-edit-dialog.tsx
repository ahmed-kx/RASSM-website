"use client";

import {
  DELIVERY_TYPES,
  DELIVERY_TYPE_LABELS,
  MAX_QUANTITY_PER_ORDER,
  SIZES,
  WILAYAS,
  adminOrderEditSchema,
  formatPrice,
  formatWilaya,
  getAvailableDeliveryTypes,
  getDeliveryFeeWithDiscount,
  getVariantStock,
  type AdminOrder,
  type AdminOrderEdit,
  type Product,
} from "@rassm/shared";
import { useQuery } from "@tanstack/react-query";
import { revalidateLogic, useForm, useStore } from "@tanstack/react-form";
import { useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { editAdminOrder } from "@/lib/data/admin";
import { getDeliveryFees } from "@/lib/data/delivery";
import { toServerErrors } from "@/lib/form-errors";
import { AdminDialog } from "./admin-dialog";

const input =
  "h-11 w-full border border-ink/25 bg-paper px-3 text-[15px] text-ink focus:border-ink focus:outline-none aria-invalid:border-error";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-ash">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Edits an order after the call (variant, quantity, customer and delivery details). The
 * live summary uses the shared helpers; the API recomputes everything and moves the stock.
 */
export function OrderEditDialog({
  order,
  product,
  onClose,
  onSaved,
}: {
  order: AdminOrder;
  product: Product;
  onClose: () => void;
  onSaved: (order: AdminOrder) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fees = useQuery({
    queryKey: ["delivery-fees"],
    queryFn: getDeliveryFees,
    staleTime: 300_000,
  });

  const defaultValues: AdminOrderEdit = {
    color: order.item.color,
    size: order.item.size,
    quantity: order.item.quantity,
    fullName: order.fullName,
    phone: order.phone,
    wilayaCode: order.wilayaCode,
    commune: order.commune,
    address: order.address,
    deliveryType: order.deliveryType,
  };

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: adminOrderEditSchema },
    onSubmit: async ({ value, formApi }) => {
      setError(null);
      try {
        onSaved(await editAdminOrder(order.id, adminOrderEditSchema.parse(value)));
      } catch (caught) {
        if (caught instanceof ApiError && Object.keys(caught.fields).length > 0) {
          const { errors, unknownMessages } = toServerErrors(
            caught.fields,
            Object.keys(defaultValues),
          );
          formApi.setErrorMap({ onDynamic: errors });
          setError(unknownMessages[0] ?? null);
          return;
        }
        setError(
          caught instanceof ApiError ? caught.message : "La commande n'a pas pu être modifiée.",
        );
      }
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  /** Units available for a variant: the stock, plus what this order already holds of it. */
  const available = (color: string, size: (typeof SIZES)[number]) =>
    getVariantStock(product, color, size) +
    (order.stockReserved && color === order.item.color && size === order.item.size
      ? order.item.quantity
      : 0);

  const fee = fees.data?.find((entry) => entry.wilayaCode === values.wilayaCode);
  let preview: { subtotal: number; delivery: number; total: number } | null = null;
  if (fees.data && fee) {
    try {
      const breakdown = getDeliveryFeeWithDiscount({
        wilayaCode: values.wilayaCode,
        deliveryType: values.deliveryType,
        items: [{ productId: product.id, quantity: values.quantity }],
        products: [product],
        deliveryFees: fees.data,
      });
      const subtotal = order.item.unitPrice * values.quantity;
      preview = {
        subtotal,
        delivery: breakdown.deliveryFee,
        total: subtotal + breakdown.deliveryFee,
      };
    } catch {
      preview = null;
    }
  }

  return (
    <AdminDialog open onClose={onClose} title="Modifier la commande">
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-ash">
          {order.item.name} · prix unitaire conservé : {formatPrice(order.item.unitPrice)}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <form.Field
            name="color"
            listeners={{ onChange: () => form.setFieldValue("quantity", 1) }}
          >
            {(field) => (
              <Field id="edit-color" label="Couleur" error={field.state.meta.errors[0]?.message}>
                <select
                  id="edit-color"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={field.state.meta.errors[0]?.message ? true : undefined}
                  className={input}
                >
                  {product.colors.map((color) => (
                    <option key={color.name} value={color.name}>
                      {color.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </form.Field>
          <form.Field name="size">
            {(field) => (
              <Field id="edit-size" label="Taille" error={field.state.meta.errors[0]?.message}>
                <select
                  id="edit-size"
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(event.target.value as AdminOrderEdit["size"])
                  }
                  aria-invalid={field.state.meta.errors[0]?.message ? true : undefined}
                  className={input}
                >
                  {SIZES.map((size) => {
                    const left = available(values.color, size);
                    return (
                      <option key={size} value={size} disabled={left === 0}>
                        {size} {left === 0 ? "(épuisée)" : `(${left} dispo)`}
                      </option>
                    );
                  })}
                </select>
              </Field>
            )}
          </form.Field>
        </div>

        <form.Field name="quantity">
          {(field) => {
            const max = Math.min(
              Math.max(available(values.color, values.size), 1),
              MAX_QUANTITY_PER_ORDER,
            );
            return (
              <Field
                id="edit-quantity"
                label="Quantité"
                error={field.state.meta.errors[0]?.message}
              >
                <div className="flex h-11 w-40 items-stretch border border-ink/25 bg-paper">
                  <button
                    type="button"
                    aria-label="Diminuer"
                    onClick={() => field.handleChange(Math.max(1, field.state.value - 1))}
                    className="w-12 text-lg"
                  >
                    −
                  </button>
                  <output
                    id="edit-quantity"
                    className="grid flex-1 place-items-center tabular-nums"
                  >
                    {field.state.value}
                  </output>
                  <button
                    type="button"
                    aria-label="Augmenter"
                    onClick={() => field.handleChange(Math.min(max, field.state.value + 1))}
                    className="w-12 text-lg"
                  >
                    +
                  </button>
                </div>
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="fullName">
          {(field) => (
            <Field
              id="edit-fullName"
              label="Nom complet"
              error={field.state.meta.errors[0]?.message}
            >
              <input
                id="edit-fullName"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.errors[0]?.message ? true : undefined}
                className={input}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <Field id="edit-phone" label="Téléphone" error={field.state.meta.errors[0]?.message}>
              <input
                id="edit-phone"
                type="tel"
                inputMode="tel"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.errors[0]?.message ? true : undefined}
                className={input}
              />
            </Field>
          )}
        </form.Field>

        <form.Field
          name="wilayaCode"
          listeners={{
            onChange: ({ value }) => {
              const selected = fees.data?.find((entry) => entry.wilayaCode === value);
              if (selected && !getAvailableDeliveryTypes(selected).includes("stopdesk")) {
                form.setFieldValue("deliveryType", "home");
              }
            },
          }}
        >
          {(field) => (
            <Field id="edit-wilaya" label="Wilaya" error={field.state.meta.errors[0]?.message}>
              <select
                id="edit-wilaya"
                value={field.state.value}
                onChange={(event) => field.handleChange(Number(event.target.value))}
                className={input}
              >
                {WILAYAS.map((wilaya) => (
                  <option key={wilaya.code} value={wilaya.code}>
                    {formatWilaya(wilaya)}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </form.Field>
        <form.Field name="commune">
          {(field) => (
            <Field id="edit-commune" label="Commune" error={field.state.meta.errors[0]?.message}>
              <input
                id="edit-commune"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.errors[0]?.message ? true : undefined}
                className={input}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="deliveryType">
          {(field) => (
            <fieldset>
              <legend className="text-xs text-ash">Mode de livraison</legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {DELIVERY_TYPES.map((type) => {
                  const disabled = fee ? !getAvailableDeliveryTypes(fee).includes(type) : false;
                  return (
                    <label
                      key={type}
                      className={cn(
                        "flex h-11 cursor-pointer items-center justify-center border text-sm",
                        field.state.value === type
                          ? "border-ink bg-ink text-paper"
                          : "border-ink/25 bg-paper",
                        disabled && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <input
                        type="radio"
                        name="edit-deliveryType"
                        value={type}
                        checked={field.state.value === type}
                        disabled={disabled}
                        onChange={() => field.handleChange(type)}
                        className="sr-only"
                      />
                      {DELIVERY_TYPE_LABELS[type]}
                    </label>
                  );
                })}
              </div>
              {field.state.meta.errors[0]?.message && (
                <p className="mt-1 text-xs text-error">{field.state.meta.errors[0]?.message}</p>
              )}
            </fieldset>
          )}
        </form.Field>

        {values.deliveryType === "home" && (
          <form.Field name="address">
            {(field) => (
              <Field id="edit-address" label="Adresse" error={field.state.meta.errors[0]?.message}>
                <input
                  id="edit-address"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors[0]?.message ? true : undefined}
                  className={input}
                />
              </Field>
            )}
          </form.Field>
        )}

        <dl className="border-t border-line pt-3 text-sm">
          <div className="flex justify-between py-1">
            <dt className="text-ash">Articles</dt>
            <dd className="tabular-nums">{preview ? formatPrice(preview.subtotal) : "—"}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-ash">Livraison</dt>
            <dd className="tabular-nums">
              {preview
                ? preview.delivery === 0
                  ? "Gratuite"
                  : formatPrice(preview.delivery)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between py-1 text-base font-semibold">
            <dt>Nouveau total</dt>
            <dd className="tabular-nums">{preview ? formatPrice(preview.total) : "—"}</dd>
          </div>
          {preview && preview.total !== order.total && (
            <p className="text-xs text-stone">Avant : {formatPrice(order.total)}</p>
          )}
        </dl>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full bg-ink text-[11px] font-semibold tracking-button text-paper uppercase disabled:opacity-60"
        >
          {isSubmitting ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </form>
    </AdminDialog>
  );
}
