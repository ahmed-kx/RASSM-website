"use client";

import {
  DELIVERY_TYPE_LABELS,
  WILAYAS,
  WILAYA_SUSPENDED_LABEL,
  formatPrice,
  formatDeliveryDelay,
  formatWilaya,
  getAvailableDeliveryTypes,
  type DeliveryFee,
  type DeliveryType,
} from "@rassm/shared";
import { useStore } from "@tanstack/react-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormField, describedBy, inputClasses } from "@/components/ui/form-field";
import { HoneypotField } from "@/components/ui/honeypot-field";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { OrderSummary } from "./order-summary";
import { ORDER_FORM_ID, useProductOrder } from "./product-order-provider";

function deliveryPrice(fee: DeliveryFee | undefined, type: DeliveryType): number | null {
  if (!fee) return null;
  return type === "home" ? fee.homePrice : fee.stopDeskPrice;
}

/** "Commander maintenant": customer details, delivery, live summary and confirmation. */
export function OrderForm() {
  const { form, product, deliveryFees, submit, submitError, placed, startCheckout, honeypotRef } =
    useProductOrder();
  const values = useStore(form.store, (state) => state.values);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const fee = deliveryFees.find((entry) => entry.wilayaCode === Number(values.wilayaCode));
  const deliveryTypes: DeliveryType[] = fee ? getAvailableDeliveryTypes(fee) : ["home", "stopdesk"];
  const busy = isSubmitting || placed;

  return (
    <section
      id={ORDER_FORM_ID}
      aria-labelledby="order-title"
      className="mt-10 scroll-mt-6 border border-ink bg-paper px-4 py-6 md:px-6 md:py-8"
    >
      <h2
        id="order-title"
        className="font-display text-3xl leading-none font-medium uppercase md:text-4xl"
      >
        Commander maintenant
      </h2>
      <p className="mt-2 text-[11px] font-semibold tracking-label text-ash uppercase">
        Paiement à la livraison
      </p>

      <form
        noValidate
        onFocusCapture={startCheckout}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void submit();
        }}
        className="mt-6 space-y-5"
      >
        <form.Field name="fullName">
          {(field) => {
            const error = field.state.meta.errors[0]?.message;
            return (
              <FormField id="order-fullName" label="Nom complet" error={error}>
                <input
                  id="order-fullName"
                  name={field.name}
                  autoComplete="name"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  {...describedBy("order-fullName", error)}
                  className={inputClasses}
                />
              </FormField>
            );
          }}
        </form.Field>

        <form.Field name="phone">
          {(field) => {
            const error = field.state.meta.errors[0]?.message;
            return (
              <FormField id="order-phone" label="Numéro de téléphone" error={error}>
                <input
                  id="order-phone"
                  name={field.name}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="0555 12 34 56"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  {...describedBy("order-phone", error)}
                  className={inputClasses}
                />
              </FormField>
            );
          }}
        </form.Field>

        <form.Field
          name="wilayaCode"
          listeners={{
            // No stop desk in this wilaya: fall back to home delivery.
            onChange: ({ value }) => {
              const selected = deliveryFees.find((entry) => entry.wilayaCode === Number(value));
              if (
                selected &&
                form.getFieldValue("deliveryType") === "stopdesk" &&
                !getAvailableDeliveryTypes(selected).includes("stopdesk")
              ) {
                form.setFieldValue("deliveryType", "home");
              }
            },
          }}
        >
          {(field) => {
            const error = field.state.meta.errors[0]?.message;
            return (
              <FormField
                id="order-wilayaCode"
                label="Wilaya"
                error={error}
                hint={
                  <>
                    {fee && (
                      <p className="font-semibold text-ink">
                        Livraison estimée : {formatDeliveryDelay(fee.estimatedDays)}
                      </p>
                    )}
                    <p>
                      Vous habitez dans une nouvelle wilaya (Aflou, Barika, Bou Saâda…) ? Choisissez
                      votre ancienne wilaya de rattachement.
                    </p>
                  </>
                }
              >
                <div className="relative">
                  <select
                    id="order-wilayaCode"
                    name={field.name}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    {...describedBy("order-wilayaCode", error)}
                    className={cn(inputClasses, "appearance-none pr-10")}
                  >
                    <option value="">Choisissez votre wilaya</option>
                    {WILAYAS.map((wilaya) => {
                      // Paused in the dashboard: shown, but it cannot be chosen.
                      const suspended = deliveryFees.some(
                        (entry) => entry.wilayaCode === wilaya.code && entry.suspended,
                      );
                      return (
                        <option key={wilaya.code} value={wilaya.code} disabled={suspended}>
                          {formatWilaya(wilaya)}
                          {suspended ? ` (${WILAYA_SUSPENDED_LABEL.toLowerCase()})` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
                  />
                </div>
              </FormField>
            );
          }}
        </form.Field>

        <form.Field name="commune">
          {(field) => {
            const error = field.state.meta.errors[0]?.message;
            return (
              <FormField id="order-commune" label="Commune" error={error}>
                <input
                  id="order-commune"
                  name={field.name}
                  autoComplete="address-level2"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  {...describedBy("order-commune", error)}
                  className={inputClasses}
                />
              </FormField>
            );
          }}
        </form.Field>

        <form.Field name="deliveryType">
          {(field) => {
            const error = field.state.meta.errors[0]?.message;
            return (
              <fieldset
                id="order-deliveryType"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "order-deliveryType-error" : undefined}
              >
                <legend className="text-[11px] font-semibold tracking-button uppercase">
                  Mode de livraison
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {deliveryTypes.map((type) => {
                    const price = deliveryPrice(fee, type);
                    return (
                      <label key={type} className="cursor-pointer">
                        <input
                          type="radio"
                          name={field.name}
                          value={type}
                          checked={field.state.value === type}
                          onChange={() => field.handleChange(type)}
                          className="peer sr-only"
                        />
                        <span className="flex h-12 items-center justify-between gap-3 border border-ink/30 bg-paper px-4 text-[15px] transition-colors peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink hover:border-ink">
                          <span className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className={cn(
                                "size-3.5 rounded-full border border-ink",
                                field.state.value === type &&
                                  "bg-ink shadow-[inset_0_0_0_2px_var(--color-paper)]",
                              )}
                            />
                            {DELIVERY_TYPE_LABELS[type]}
                          </span>
                          {price !== null && (
                            <span className="text-sm text-ash tabular-nums">
                              {formatPrice(price)}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ash">
                  {!fee
                    ? "Choisissez votre wilaya pour voir les tarifs."
                    : !deliveryTypes.includes("stopdesk")
                      ? "Pas de livraison au bureau (stop desk) dans cette wilaya : livraison à domicile uniquement."
                      : field.state.value === "stopdesk"
                        ? "Vous récupérez votre colis au bureau du livreur dans votre wilaya."
                        : "Livraison à votre adresse."}
                </p>
                {error && (
                  <p id="order-deliveryType-error" className="mt-2 text-sm text-error">
                    {error}
                  </p>
                )}
              </fieldset>
            );
          }}
        </form.Field>

        <form.Field name="address">
          {(field) => {
            const error = field.state.meta.errors[0]?.message;
            return (
              <FormField
                id="order-address"
                label="Adresse"
                optional={values.deliveryType === "stopdesk"}
                error={error}
              >
                <input
                  id="order-address"
                  name={field.name}
                  autoComplete="street-address"
                  placeholder="Rue, quartier, bâtiment…"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  {...describedBy("order-address", error)}
                  className={inputClasses}
                />
              </FormField>
            );
          }}
        </form.Field>

        <HoneypotField id="order-website" ref={honeypotRef} />
        <OrderSummary product={product} deliveryFees={deliveryFees} values={values} />

        {submitError && (
          <p role="alert" className="text-sm text-error">
            {submitError}
          </p>
        )}

        <Button
          type="submit"
          surface="light"
          disabled={busy}
          className="w-full disabled:opacity-60"
        >
          {busy ? "Envoi de la commande…" : "Confirmer la commande"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-ash">
          Aucun paiement en ligne : vous payez à la réception de votre colis.
          <br />
          <Link
            href={routes.exchanges}
            className="text-ink underline underline-offset-4 hover:no-underline"
          >
            Échange possible le jour de la livraison
          </Link>
        </p>
        <p className="-mt-2 text-center text-[11px] leading-relaxed text-stone">
          Vos données servent à traiter votre commande.{" "}
          <Link href={routes.privacy} className="underline underline-offset-4 hover:no-underline">
            Confidentialité
          </Link>
        </p>
      </form>
    </section>
  );
}
