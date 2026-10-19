"use client";

import {
  DELIVERY_TYPE_LABELS,
  deliveryTypeSchema,
  formatDiscount,
  formatNextTierMessage,
  formatPrice,
  getDeliveryDiscountProgress,
  getDeliveryFeeWithDiscount,
  getWilaya,
  type DeliveryFee,
  type Product,
  type ProductOrderFormValues,
} from "@rassm/shared";
import type { ReactNode } from "react";
import { TruckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

interface SummaryInput {
  product: Product;
  deliveryFees: readonly DeliveryFee[];
  values: Pick<
    ProductOrderFormValues,
    "quantity" | "wilayaCode" | "deliveryType" | "size" | "color"
  >;
}

/** The delivery fee for the chosen wilaya and mode, or null while the wilaya is not chosen. */
function getDelivery({ product, deliveryFees, values }: SummaryInput) {
  const wilayaCode = Number(values.wilayaCode);
  const deliveryType = deliveryTypeSchema.safeParse(values.deliveryType);
  if (!getWilaya(wilayaCode) || !deliveryType.success) return null;
  try {
    return getDeliveryFeeWithDiscount({
      wilayaCode,
      deliveryType: deliveryType.data,
      items: [{ productId: product.id, quantity: values.quantity }],
      products: [product],
      deliveryFees,
    });
  } catch {
    // Stop desk where there is none: the form switches back to home delivery.
    return null;
  }
}

function Row({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <dt>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

/** Live order summary: product × quantity, delivery, discount, total and the next tier. */
export function OrderSummary(input: SummaryInput) {
  const { product, values } = input;
  const subtotal = product.price * values.quantity;
  const delivery = getDelivery(input);
  // Before the wilaya is chosen, the tiers reached are shown without the fee.
  const progress = delivery
    ? null
    : getDeliveryDiscountProgress({
        items: [{ productId: product.id, quantity: values.quantity }],
        products: [product],
      });
  const next = (delivery ?? progress)?.nextDeliveryDiscountTiers[0];
  const wilaya = getWilaya(Number(values.wilayaCode));
  const details = [values.color, values.size && `taille ${values.size}`].filter(Boolean).join(", ");

  return (
    <div className="border border-line bg-bone px-4 py-4 text-sm" aria-live="polite">
      <h3 className="text-[11px] font-semibold tracking-label uppercase">Récapitulatif</h3>
      <dl className="mt-3 space-y-2">
        <Row
          label={`${product.name}${details ? ` (${details})` : ""} × ${values.quantity}`}
          value={formatPrice(subtotal)}
        />
        {delivery ? (
          <>
            <Row
              label={`Livraison ${DELIVERY_TYPE_LABELS[values.deliveryType === "stopdesk" ? "stopdesk" : "home"].toLowerCase()}${wilaya ? `, ${wilaya.name}` : ""}`}
              value={
                delivery.freeDelivery ? (
                  <>
                    <s className="mr-2 text-stone">{formatPrice(delivery.deliveryFeeBase)}</s>
                    <span className="font-semibold">Livraison gratuite</span>
                  </>
                ) : (
                  formatPrice(delivery.deliveryFeeBase)
                )
              }
            />
            {!delivery.freeDelivery && delivery.deliveryDiscount > 0 && (
              <Row label="Réduction livraison" value={formatDiscount(delivery.deliveryDiscount)} />
            )}
          </>
        ) : (
          <>
            <Row
              label="Livraison"
              value={<span className="text-stone">Choisissez votre wilaya</span>}
            />
            {progress?.freeDelivery && <Row label="Livraison gratuite" value="" />}
            {progress && !progress.freeDelivery && progress.amountDiscount > 0 && (
              <Row label="Réduction livraison" value={formatDiscount(progress.amountDiscount)} />
            )}
          </>
        )}
        <Row
          label="Total"
          value={
            delivery ? (
              formatPrice(subtotal + delivery.deliveryFee)
            ) : (
              <>
                {formatPrice(subtotal)} <span className="text-xs text-stone">+ livraison</span>
              </>
            )
          }
          className="border-t border-line pt-3 text-base font-semibold"
        />
      </dl>
      {next && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ash">
          <TruckIcon width={18} height={18} className="shrink-0" />
          {formatNextTierMessage(next)}
        </p>
      )}
    </div>
  );
}
