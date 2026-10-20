"use client";

import {
  CATEGORIES,
  CATEGORY_SINGULAR_LABELS,
  MAX_COLORS_PER_PRODUCT,
  MAX_DELIVERY_DISCOUNT_TIERS,
  SIZES,
  createAdminProductInputSchema,
  deliveryDiscountTiersSchema,
  formatDeliveryDiscountTiers,
  formatPrice,
  slugify,
  type AdminProductDetail,
  type AdminProductInput,
  type DeliveryDiscountTier,
} from "@rassm/shared";
import { revalidateLogic, useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalIcon, PlusIcon, TrashIcon, TruckIcon } from "@/components/ui/icons";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { createAdminProduct, discardUploadedImage, updateAdminProduct } from "@/lib/data/admin";
import { routes } from "@/lib/routes";
import {
  AdminCard,
  AdminPageHeader,
  Switch,
  adminField,
  adminInput,
  adminLabel,
  buttonClass,
} from "./admin-ui";
import { ProductStatusBadge } from "./badges";
import { ProductPhotos } from "./product-photos";
import { LowVariantHint, StockCell } from "./stock-grid-dialog";
import { useToast } from "./toasts";

const emptyStock = () =>
  Object.fromEntries(
    SIZES.map((size) => [size, 0]),
  ) as AdminProductInput["colors"][number]["stock"];

const NEW_PRODUCT: AdminProductInput = {
  name: "",
  slug: "",
  description: "",
  category: "hoodie",
  price: 0,
  costPrice: null,
  colors: [{ name: "Noir", hex: "#111111", images: [], stock: emptyStock() }],
  featured: false,
  isActive: true,
  deliveryDiscountTiers: [],
  drop: "Drop 001",
};

/** The form values of a saved product. */
function inputOf(detail: AdminProductDetail): AdminProductInput {
  const { product } = detail;
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category,
    price: product.price,
    costPrice: detail.costPrice,
    colors: product.colors.map((color, index) => ({
      name: color.name,
      hex: color.hex,
      // Products saved before photos per color: the first color gets the product photos.
      images: color.images?.length ? [...color.images] : index === 0 ? [...product.images] : [],
      stock: { ...color.stock },
    })),
    featured: product.featured,
    isActive: product.isActive,
    deliveryDiscountTiers: product.deliveryDiscountTiers.map((tier) => ({ ...tier })),
    drop: product.drop,
  };
}

/** API error keys ("colors.0.images") → form field names ("colors[0].images"). */
const toFieldName = (key: string) => key.replace(/\.(\d+)(?=\.|$)/g, "[$1]");

/** Warns before leaving with unsaved changes (closing the tab or following a link). */
function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const message = "Les modifications non enregistrées seront perdues. Quitter quand même ?";
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}

const errorOf = (errors: readonly unknown[]): string | undefined => {
  const first = errors[0];
  if (!first) return undefined;
  if (typeof first === "string") return first;
  return (first as { message?: string }).message;
};

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="mt-1.5 text-sm text-error">
      {error}
    </p>
  );
}

const describedBy = (id: string, error?: string) =>
  error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};

export function ProductForm({
  detail,
  maxHomeDeliveryPrice,
}: {
  /** Absent for a new product. */
  detail?: AdminProductDetail;
  maxHomeDeliveryPrice: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(detail));
  /** Photos uploaded in this visit and not saved yet: deleted if removed or abandoned. */
  const fresh = useRef(new Set<string>());
  const saved = useRef(false);
  const schema = useMemo(
    () => createAdminProductInputSchema(maxHomeDeliveryPrice),
    [maxHomeDeliveryPrice],
  );
  const product = detail?.product;

  const save = useMutation({
    mutationFn: (values: AdminProductInput) =>
      detail
        ? updateAdminProduct(detail.product.id, values, detail.updatedAt)
        : createAdminProduct(values),
  });

  const form = useForm({
    defaultValues: detail ? inputOf(detail) : NEW_PRODUCT,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const result = await save.mutateAsync(schema.parse(value));
        saved.current = true;
        fresh.current.clear();
        queryClient.setQueryData(["admin", "product", result.product.id], result);
        void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
        showToast({
          title: detail ? "Produit enregistré" : "Produit créé",
          message: `${result.product.name} · ${result.product.sku}`,
          tone: "success",
        });
        if (!detail) router.replace(adminRoutes.product(result.product.id));
      } catch (caught) {
        if (caught instanceof ApiError && Object.keys(caught.fields).length > 0) {
          form.setErrorMap({
            onDynamic: {
              fields: Object.fromEntries(
                Object.entries(caught.fields).map(([key, message]) => [
                  toFieldName(key),
                  [{ message }],
                ]),
              ),
            },
          });
        }
        setFormError(
          caught instanceof ApiError ? caught.message : "Le produit n'a pas pu être enregistré.",
        );
      }
    },
    onSubmitInvalid: () => {
      setFormError("Certains champs sont à corriger : voir les messages en rouge.");
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('main [aria-invalid="true"]')?.focus(),
      );
    },
  });

  const dirty = useStore(form.store, (state) => state.isDirty);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const tiers = useStore(form.store, (state) => state.values.deliveryDiscountTiers);
  const colorCount = useStore(form.store, (state) => state.values.colors.length);
  useUnsavedChangesWarning(dirty && !isSubmitting);

  // Photos uploaded but never saved (page left without saving) are deleted.
  useEffect(() => {
    const uploads = fresh.current;
    return () => {
      if (!saved.current) for (const url of uploads) void discardUploadedImage(url);
    };
  }, []);

  const colorImages = (index: number) => form.getFieldValue(`colors[${index}].images`) ?? [];
  const setColorImages = (index: number, images: string[]) =>
    form.setFieldValue(`colors[${index}].images`, images);

  const removePhoto = (index: number, url: string) => {
    setColorImages(
      index,
      colorImages(index).filter((item) => item !== url),
    );
    if (fresh.current.has(url)) {
      fresh.current.delete(url);
      void discardUploadedImage(url);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="pb-24 lg:pb-0"
    >
      <AdminPageHeader
        eyebrow={product ? `Produit · ${product.sku}` : "Catalogue"}
        title={product ? product.name : "Nouveau produit"}
        subtitle={
          product ? "Photos, prix, stock et réductions" : "Le SKU est créé à l'enregistrement"
        }
        actions={
          <>
            {product?.isActive && (
              <a
                href={routes.product(product.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("soft", "h-12", "plain")}
              >
                <ExternalIcon width={18} height={18} /> Voir sur le site
              </a>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className={buttonClass("primary", "hidden h-12 lg:inline-flex", "plain")}
            >
              {isSubmitting ? "Enregistrement…" : product ? "Enregistrer" : "Créer le produit"}
            </button>
          </>
        }
      />
      {product && detail && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ash">
          <ProductStatusBadge status={product.isActive ? "active" : "hidden"} />
          {detail.orderCount > 0
            ? `${detail.orderCount} commande${detail.orderCount > 1 ? "s" : ""} : ce produit peut être masqué, pas supprimé.`
            : "Aucune commande pour le moment."}
        </p>
      )}
      {formError && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-error/40 bg-error/5 px-4 py-3 text-sm text-error"
        >
          {formError}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="grid gap-4">
          {/* Information */}
          <AdminCard title="Informations">
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="name">
                {(field) => {
                  const error = errorOf(field.state.meta.errors);
                  return (
                    <div className="sm:col-span-2">
                      <label htmlFor="product-name" className={adminLabel}>
                        Nom
                      </label>
                      <input
                        id="product-name"
                        value={field.state.value}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          if (!slugTouched) form.setFieldValue("slug", slugify(event.target.value));
                        }}
                        onBlur={field.handleBlur}
                        maxLength={80}
                        className={cn(adminInput, "mt-1.5")}
                        {...describedBy("product-name", error)}
                      />
                      <FieldError id="product-name" error={error} />
                    </div>
                  );
                }}
              </form.Field>
              <form.Field name="slug">
                {(field) => {
                  const error = errorOf(field.state.meta.errors);
                  return (
                    <div className="sm:col-span-2">
                      <label htmlFor="product-slug" className={adminLabel}>
                        Adresse de la page (slug)
                      </label>
                      <div className="mt-1.5 flex items-stretch overflow-hidden rounded-sm border border-line bg-paper focus-within:border-ink">
                        <span className="hidden items-center bg-cream/60 px-3 text-sm text-stone sm:flex">
                          /collection/
                        </span>
                        <input
                          id="product-slug"
                          value={field.state.value}
                          onChange={(event) => {
                            setSlugTouched(true);
                            field.handleChange(event.target.value);
                          }}
                          onBlur={() => {
                            field.handleChange(slugify(field.state.value));
                            field.handleBlur();
                          }}
                          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] focus:outline-none"
                          {...describedBy("product-slug", error)}
                        />
                      </div>
                      <p className="mt-1 text-xs text-stone">
                        Créé à partir du nom ; modifiable. Changer le slug change l&apos;adresse de
                        la page.
                      </p>
                      <FieldError id="product-slug" error={error} />
                    </div>
                  );
                }}
              </form.Field>
              <form.Field name="description">
                {(field) => {
                  const error = errorOf(field.state.meta.errors);
                  return (
                    <div className="sm:col-span-2">
                      <label htmlFor="product-description" className={adminLabel}>
                        Description
                      </label>
                      <textarea
                        id="product-description"
                        rows={5}
                        maxLength={2000}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        className={cn(adminField, "mt-1.5 bg-paper py-3 leading-relaxed")}
                        {...describedBy("product-description", error)}
                      />
                      <FieldError id="product-description" error={error} />
                    </div>
                  );
                }}
              </form.Field>
              <form.Field name="category">
                {(field) => (
                  <div>
                    <label htmlFor="product-category" className={adminLabel}>
                      Catégorie
                    </label>
                    <select
                      id="product-category"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value as AdminProductInput["category"])
                      }
                      className={cn(adminInput, "mt-1.5")}
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_SINGULAR_LABELS[category]}
                        </option>
                      ))}
                    </select>
                    {product && product.category !== field.state.value && (
                      <p className="mt-1 text-xs text-stone">Le SKU {product.sku} ne change pas.</p>
                    )}
                  </div>
                )}
              </form.Field>
              <form.Field name="price">
                {(field) => {
                  const error = errorOf(field.state.meta.errors);
                  return (
                    <div>
                      <label htmlFor="product-price" className={adminLabel}>
                        Prix (DA)
                      </label>
                      <input
                        id="product-price"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={100}
                        value={
                          Number.isFinite(field.state.value) && field.state.value !== 0
                            ? field.state.value
                            : ""
                        }
                        onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                        onBlur={field.handleBlur}
                        placeholder="7900"
                        className={cn(adminInput, "mt-1.5 tabular-nums")}
                        {...describedBy("product-price", error)}
                      />
                      {!error && Number.isFinite(field.state.value) && field.state.value > 0 && (
                        <p className="mt-1 text-xs text-stone">
                          Affiché : {formatPrice(field.state.value)}
                        </p>
                      )}
                      <FieldError id="product-price" error={error} />
                    </div>
                  );
                }}
              </form.Field>
              <form.Field name="costPrice">
                {(field) => {
                  const error = errorOf(field.state.meta.errors);
                  const cost = field.state.value;
                  return (
                    <div>
                      <label htmlFor="product-cost" className={adminLabel}>
                        Prix de revient (DA)
                      </label>
                      <input
                        id="product-cost"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={100}
                        value={cost ?? ""}
                        onChange={(event) =>
                          field.handleChange(
                            event.target.value === "" ? null : event.target.valueAsNumber,
                          )
                        }
                        onBlur={field.handleBlur}
                        placeholder="Facultatif"
                        className={cn(adminInput, "mt-1.5 tabular-nums")}
                        {...describedBy("product-cost", error)}
                      />
                      {!error && (
                        <form.Subscribe selector={(state) => state.values.price}>
                          {(price) => (
                            <p className="mt-1 text-xs text-stone">
                              {typeof cost === "number" && Number.isFinite(cost) && price > 0
                                ? `Marge par article : ${formatPrice(price - cost)} (${Math.round(((price - cost) / price) * 100)} %)`
                                : "Visible seulement ici. Sert au calcul du bénéfice."}
                            </p>
                          )}
                        </form.Subscribe>
                      )}
                      <FieldError id="product-cost" error={error} />
                    </div>
                  );
                }}
              </form.Field>
              <form.Field name="drop">
                {(field) => {
                  const error = errorOf(field.state.meta.errors);
                  return (
                    <div>
                      <label htmlFor="product-drop" className={adminLabel}>
                        Drop
                      </label>
                      <input
                        id="product-drop"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Drop 001"
                        className={cn(adminInput, "mt-1.5")}
                        {...describedBy("product-drop", error)}
                      />
                      <FieldError id="product-drop" error={error} />
                    </div>
                  );
                }}
              </form.Field>
            </div>
          </AdminCard>

          {/* Colors, photos and stock */}
          <AdminCard title="Couleurs, photos et stock">
            <form.Field name="colors" mode="array">
              {(colorsField) => (
                <div className="grid gap-5">
                  {colorsField.state.value.map((_color, index) => (
                    <fieldset
                      key={index}
                      className="rounded-md border border-line bg-bone/50 p-3.5 sm:p-4"
                    >
                      <legend className="sr-only">Couleur {index + 1}</legend>
                      <div className="flex flex-wrap items-end gap-3">
                        <form.Field name={`colors[${index}].name`}>
                          {(field) => {
                            const error = errorOf(field.state.meta.errors);
                            const id = `color-${index}-name`;
                            return (
                              <div className="min-w-40 flex-1">
                                <label htmlFor={id} className={adminLabel}>
                                  Couleur {index + 1}
                                </label>
                                <input
                                  id={id}
                                  value={field.state.value}
                                  onChange={(event) => field.handleChange(event.target.value)}
                                  onBlur={field.handleBlur}
                                  placeholder="Noir"
                                  className={cn(adminInput, "mt-1.5")}
                                  {...describedBy(id, error)}
                                />
                                <FieldError id={id} error={error} />
                              </div>
                            );
                          }}
                        </form.Field>
                        <form.Field name={`colors[${index}].hex`}>
                          {(field) => {
                            const error = errorOf(field.state.meta.errors);
                            const id = `color-${index}-hex`;
                            return (
                              <div>
                                <label htmlFor={id} className={adminLabel}>
                                  Pastille
                                </label>
                                <div className="mt-1.5 flex h-11 items-center gap-2 rounded-sm border border-line bg-paper px-2">
                                  <input
                                    type="color"
                                    aria-label={`Choisir la pastille de la couleur ${index + 1}`}
                                    value={
                                      /^#[0-9a-f]{6}$/i.test(field.state.value)
                                        ? field.state.value
                                        : "#111111"
                                    }
                                    onChange={(event) =>
                                      field.handleChange(event.target.value.toUpperCase())
                                    }
                                    className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
                                  />
                                  <input
                                    id={id}
                                    value={field.state.value}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                    onBlur={field.handleBlur}
                                    maxLength={7}
                                    className="w-20 bg-transparent text-sm uppercase tabular-nums focus:outline-none"
                                    {...describedBy(id, error)}
                                  />
                                </div>
                                <FieldError id={id} error={error} />
                              </div>
                            );
                          }}
                        </form.Field>
                        {colorsField.state.value.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              for (const url of colorImages(index)) {
                                if (fresh.current.has(url)) {
                                  fresh.current.delete(url);
                                  void discardUploadedImage(url);
                                }
                              }
                              colorsField.removeValue(index);
                            }}
                            className="flex h-11 items-center gap-1.5 px-2 text-sm text-error underline underline-offset-4"
                          >
                            <TrashIcon width={16} height={16} /> Retirer
                          </button>
                        )}
                      </div>

                      <p className={cn(adminLabel, "mt-4 mb-2")}>Photos</p>
                      <form.Field name={`colors[${index}].images`}>
                        {(field) => (
                          <ProductPhotos
                            colorName={
                              form.getFieldValue(`colors[${index}].name`) || `Couleur ${index + 1}`
                            }
                            images={field.state.value}
                            error={errorOf(field.state.meta.errors)}
                            onAdd={(url) => {
                              fresh.current.add(url);
                              setColorImages(index, [...colorImages(index), url]);
                            }}
                            onMove={(from, to) => {
                              const list = [...colorImages(index)];
                              const [moved] = list.splice(from, 1);
                              if (moved) list.splice(to, 0, moved);
                              setColorImages(index, list);
                            }}
                            onRemove={(url) => removePhoto(index, url)}
                          />
                        )}
                      </form.Field>

                      <p className={cn(adminLabel, "mt-4 mb-2")}>Stock par taille</p>
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                        {SIZES.map((size) => (
                          <form.Field key={size} name={`colors[${index}].stock.${size}`}>
                            {(field) => (
                              <StockCell
                                id={`color-${index}-stock-${size}`}
                                size={size}
                                value={field.state.value}
                                onChange={(value) => field.handleChange(value)}
                                onBlur={field.handleBlur}
                                error={errorOf(field.state.meta.errors)}
                              />
                            )}
                          </form.Field>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-stone">0 = taille non vendue ou épuisée.</p>
                      <div className="mt-1.5">
                        <LowVariantHint />
                      </div>
                    </fieldset>
                  ))}
                  {colorCount < MAX_COLORS_PER_PRODUCT && (
                    <button
                      type="button"
                      onClick={() =>
                        colorsField.pushValue({
                          name: "",
                          hex: "#EDE8DF",
                          images: [],
                          stock: emptyStock(),
                        })
                      }
                      className={buttonClass("outline", "justify-self-start", "plain")}
                    >
                      <PlusIcon width={18} height={18} /> Ajouter une couleur
                    </button>
                  )}
                  <FieldError id="product-colors" error={errorOf(colorsField.state.meta.errors)} />
                </div>
              )}
            </form.Field>
          </AdminCard>

          {/* Delivery discount tiers */}
          <AdminCard title="Réductions sur la livraison">
            <p className="text-sm text-ash">
              Selon la quantité commandée, la livraison coûte moins cher (jamais le prix du
              produit). Le montant doit rester inférieur au tarif à domicile le plus élevé (
              {formatPrice(maxHomeDeliveryPrice)}).
            </p>
            <form.Field name="deliveryDiscountTiers" mode="array">
              {(tiersField) => (
                <div className="mt-4">
                  {tiersField.state.value.length > 0 && (
                    <div
                      className={cn(
                        adminLabel,
                        "hidden grid-cols-[1fr_1.4fr_1fr_2.75rem] gap-3 pb-2 sm:grid",
                      )}
                    >
                      <span>Quantité minimum</span>
                      <span>Type</span>
                      <span>Montant (DA)</span>
                      <span />
                    </div>
                  )}
                  <ul className="grid gap-3">
                    {tiersField.state.value.map((tier, index) => (
                      <li
                        key={index}
                        className="grid grid-cols-2 gap-3 rounded-md border border-line p-3 sm:grid-cols-[1fr_1.4fr_1fr_2.75rem] sm:items-start sm:border-0 sm:p-0"
                      >
                        <form.Field name={`deliveryDiscountTiers[${index}].minQuantity`}>
                          {(field) => {
                            const error = errorOf(field.state.meta.errors);
                            const id = `tier-${index}-min`;
                            return (
                              <div>
                                <label htmlFor={id} className={cn(adminLabel, "sm:sr-only")}>
                                  Quantité minimum
                                </label>
                                <input
                                  id={id}
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  value={
                                    Number.isFinite(field.state.value) ? field.state.value : ""
                                  }
                                  onChange={(event) =>
                                    field.handleChange(event.target.valueAsNumber)
                                  }
                                  onBlur={field.handleBlur}
                                  className={cn(adminInput, "mt-1.5 sm:mt-0")}
                                  {...describedBy(id, error)}
                                />
                                <FieldError id={id} error={error} />
                              </div>
                            );
                          }}
                        </form.Field>
                        <div>
                          <label
                            htmlFor={`tier-${index}-type`}
                            className={cn(adminLabel, "sm:sr-only")}
                          >
                            Type
                          </label>
                          <select
                            id={`tier-${index}-type`}
                            value={tier.type}
                            onChange={(event) => {
                              const next: DeliveryDiscountTier =
                                event.target.value === "free"
                                  ? { type: "free", minQuantity: tier.minQuantity }
                                  : { type: "amount", minQuantity: tier.minQuantity, amount: 100 };
                              tiersField.replaceValue(index, next);
                            }}
                            className={cn(adminInput, "mt-1.5 sm:mt-0")}
                          >
                            <option value="amount">Montant en moins</option>
                            <option value="free">Livraison gratuite</option>
                          </select>
                        </div>
                        {tier.type === "amount" ? (
                          <form.Field name={`deliveryDiscountTiers[${index}].amount`}>
                            {(field) => {
                              const error = errorOf(field.state.meta.errors);
                              const id = `tier-${index}-amount`;
                              const value = field.state.value as number | undefined;
                              return (
                                <div>
                                  <label htmlFor={id} className={cn(adminLabel, "sm:sr-only")}>
                                    Montant (DA)
                                  </label>
                                  <input
                                    id={id}
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    step={50}
                                    value={
                                      value !== undefined && Number.isFinite(value) ? value : ""
                                    }
                                    onChange={(event) =>
                                      field.handleChange(event.target.valueAsNumber)
                                    }
                                    onBlur={field.handleBlur}
                                    className={cn(adminInput, "mt-1.5 sm:mt-0")}
                                    {...describedBy(id, error)}
                                  />
                                  <FieldError id={id} error={error} />
                                </div>
                              );
                            }}
                          </form.Field>
                        ) : (
                          <p className="flex h-11 items-center text-sm text-stone sm:mt-0">—</p>
                        )}
                        <button
                          type="button"
                          aria-label={`Supprimer le palier ${index + 1}`}
                          onClick={() => tiersField.removeValue(index)}
                          className="grid size-11 place-items-center justify-self-end rounded-sm text-error hover:bg-error/5"
                        >
                          <TrashIcon width={18} height={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <FieldError id="product-tiers" error={errorOf(tiersField.state.meta.errors)} />
                  {tiersField.state.value.length < MAX_DELIVERY_DISCOUNT_TIERS && (
                    <button
                      type="button"
                      onClick={() => {
                        const last = tiersField.state.value.at(-1);
                        tiersField.pushValue({
                          type: "amount",
                          minQuantity: (last?.minQuantity ?? 0) + 1,
                          amount: last?.type === "amount" ? last.amount + 100 : 100,
                        });
                      }}
                      className={buttonClass("outline", "mt-4", "plain")}
                    >
                      <PlusIcon width={18} height={18} /> Ajouter un palier
                    </button>
                  )}
                </div>
              )}
            </form.Field>
            <TierPreview tiers={tiers} />
          </AdminCard>
        </div>

        {/* Publication */}
        <div className="grid gap-4 lg:sticky lg:top-24">
          <AdminCard title="Publication">
            <form.Field name="isActive">
              {(field) => (
                <Switch
                  label="Visible sur le site"
                  description="Masqué : absent de la collection, sa page n'existe plus."
                  checked={field.state.value}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
            <form.Field name="featured">
              {(field) => (
                <Switch
                  label="Mis en avant"
                  description="Affiché dans « Produits phares » sur l'accueil."
                  checked={field.state.value}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
            <button
              type="submit"
              disabled={isSubmitting}
              className={buttonClass("primary", "mt-4 hidden h-12 w-full lg:inline-flex", "plain")}
            >
              {isSubmitting ? "Enregistrement…" : product ? "Enregistrer" : "Créer le produit"}
            </button>
            {dirty && (
              <p className="mt-2 hidden text-center text-xs text-warning lg:block">
                Modifications non enregistrées
              </p>
            )}
          </AdminCard>
          {product && (
            <Link
              href={adminRoutes.products}
              className="text-center text-sm text-ash underline underline-offset-4"
            >
              Retour aux produits
            </Link>
          )}
        </div>
      </div>

      {/* Phones: save bar above the bottom navigation */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 border-t border-line bg-bone/95 px-4 py-2.5 backdrop-blur-sm lg:hidden">
        <p className="min-w-0 flex-1 truncate text-xs text-stone">
          {dirty
            ? "Modifications non enregistrées"
            : product
              ? "Tout est enregistré"
              : "Nouveau produit"}
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className={buttonClass("primary", "h-11", "plain")}
        >
          {isSubmitting ? "Enregistrement…" : product ? "Enregistrer" : "Créer le produit"}
        </button>
      </div>
    </form>
  );
}

/** The same box and text as the product page, as soon as the tiers are valid. */
function TierPreview({ tiers }: { tiers: AdminProductInput["deliveryDiscountTiers"] }) {
  const parsed = deliveryDiscountTiersSchema.safeParse(tiers);
  if (tiers.length === 0) {
    return (
      <p className="mt-4 text-sm text-stone">Aucune réduction : la livraison est au prix normal.</p>
    );
  }
  if (!parsed.success) {
    return (
      <p className="mt-4 text-sm text-stone">
        Corrigez les paliers pour voir l&apos;aperçu sur la page produit.
      </p>
    );
  }
  return (
    <div className="mt-4">
      <p className={cn(adminLabel, "mb-2")}>Aperçu sur la page produit</p>
      <div className="flex gap-3 border border-line bg-paper px-4 py-3">
        <TruckIcon width={22} height={22} className="mt-0.5 shrink-0" />
        <div className="text-[13px]">
          <p className="font-semibold">Livraison réduite sur ce produit</p>
          <p className="mt-1 text-ash">{formatDeliveryDiscountTiers(parsed.data)}</p>
        </div>
      </div>
    </div>
  );
}
