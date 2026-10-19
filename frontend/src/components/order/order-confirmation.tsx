"use client";

import {
  DELIVERY_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  formatDiscount,
  formatPrice,
  getWilaya,
  type PlacedOrder,
} from "@rassm/shared";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { PIXEL_CURRENCY, trackPurchaseOnce } from "@/lib/analytics/meta-pixel";
import { getLastOrder } from "@/lib/data/orders";
import { routes } from "@/lib/routes";

type State =
  { status: "loading" } | { status: "missing" } | { status: "found"; placed: PlacedOrder };

/** "0555123456" → "0555 12 34 56" */
function formatPhone(phone: string): string {
  return phone.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
}

function Row({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold"
          : "flex justify-between gap-4"
      }
    >
      <dt>{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * Thank-you content: the order is "reçue", confirmed only after our phone call. Loads the last
 * order, then sends the Purchase event once per order, with the internal order id as event
 * id (the same as the server-side Conversions API event, so Meta counts it once). The order
 * number is internal and is never shown.
 */
export function OrderReceived() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void getLastOrder().then((placed) => {
      if (cancelled) return;
      setState(placed ? { status: "found", placed } : { status: "missing" });
      if (placed) {
        const { order } = placed;
        trackPurchaseOnce(placed.eventId, {
          value: order.total,
          currency: PIXEL_CURRENCY,
          content_ids: [order.item.productId],
          content_type: "product",
          contents: [{ id: order.item.productId, quantity: order.item.quantity }],
          num_items: order.item.quantity,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <p className="min-h-[50vh] text-sm text-ash">Chargement de votre commande…</p>;
  }

  if (state.status === "missing") {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-display text-4xl leading-none font-medium uppercase md:text-5xl">
          Commande reçue
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-ash">
          Si vous venez de commander, pas d&apos;inquiétude : nous vous appellerons très bientôt
          pour la confirmer.
        </p>
        <Button
          href={routes.collection}
          surface="light"
          variant="outlined"
          withArrow
          className="mt-8"
        >
          Retour à la collection
        </Button>
      </div>
    );
  }

  const { order } = state.placed;
  const { item } = order;
  const wilaya = getWilaya(order.wilayaCode);

  return (
    <div className="mx-auto max-w-2xl">
      <SectionLabel className="text-stone">Commande reçue</SectionLabel>
      <h1 className="mt-3 font-display text-4xl leading-none font-medium uppercase md:text-6xl">
        Merci, votre commande est bien reçue.
      </h1>
      <p className="mt-5 text-[15px] leading-relaxed text-ash">
        Nous vous appellerons très bientôt pour la confirmer. Gardez votre téléphone à portée de
        main.
      </p>
      <p className="mt-4 border-l-2 border-ink pl-4 text-[15px] leading-relaxed">
        Votre commande ne sera confirmée qu&apos;après cet appel, au{" "}
        <strong className="whitespace-nowrap">{formatPhone(order.phone)}</strong>. Nous y vérifions
        avec vous le produit, la taille et l&apos;adresse avant l&apos;expédition.
      </p>

      <section
        aria-labelledby="summary-title"
        className="mt-10 border border-line bg-paper p-5 md:p-6"
      >
        <h2 id="summary-title" className="text-[11px] font-semibold tracking-label uppercase">
          Récapitulatif
        </h2>
        <div className="mt-4 flex gap-4">
          {item.image && (
            <div className="relative size-20 shrink-0 bg-cream">
              <Image src={item.image} alt="" fill sizes="80px" className="object-cover" />
            </div>
          )}
          <div className="text-sm">
            <p className="font-semibold tracking-[0.06em] uppercase">{item.name}</p>
            <p className="mt-1 text-ash">
              {item.color}, taille {item.size} · Quantité : {item.quantity}
            </p>
          </div>
        </div>
        <dl className="mt-5 space-y-2 text-sm">
          <Row label={`Articles (${item.quantity} × ${formatPrice(item.unitPrice)})`}>
            {formatPrice(order.subtotal)}
          </Row>
          <Row label={`Livraison ${DELIVERY_TYPE_LABELS[order.deliveryType].toLowerCase()}`}>
            {order.freeDelivery ? (
              <>
                <s className="mr-2 text-stone">{formatPrice(order.deliveryFeeBase)}</s>
                <span className="font-semibold">Livraison gratuite</span>
              </>
            ) : (
              formatPrice(order.deliveryFeeBase)
            )}
          </Row>
          {!order.freeDelivery && order.deliveryDiscount > 0 && (
            <Row label="Réduction livraison">{formatDiscount(order.deliveryDiscount)}</Row>
          )}
          <Row label="Total à payer à la livraison" strong>
            {formatPrice(order.total)}
          </Row>
        </dl>

        <div className="mt-6 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold tracking-label uppercase">Livraison</p>
            <p className="mt-2 leading-relaxed text-ash">
              {order.fullName}
              <br />
              {order.deliveryType === "home" && order.address && (
                <>
                  {order.address}
                  <br />
                </>
              )}
              {order.commune}
              {wilaya ? `, ${wilaya.name}` : ""}
              <br />
              {DELIVERY_TYPE_LABELS[order.deliveryType]}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-label uppercase">Paiement</p>
            <p className="mt-2 leading-relaxed text-ash">
              {PAYMENT_METHOD_LABELS[order.paymentMethod]}
            </p>
          </div>
        </div>
      </section>

      <Button
        href={routes.collection}
        surface="light"
        variant="outlined"
        withArrow
        className="mt-10"
      >
        Retour à la collection
      </Button>
    </div>
  );
}
