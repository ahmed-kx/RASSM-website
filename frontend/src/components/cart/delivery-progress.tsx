"use client";

import {
  formatArticleCount,
  formatDiscount,
  formatTierBenefit,
  getDeliveryDiscountProgress,
  type CartItem,
  type Product,
} from "@rassm/shared";
import { CheckIcon, TruckIcon } from "@/components/ui/icons";

/**
 * Delivery discount progress in the cart, from the shared tier rules. No price yet:
 * the delivery fee depends on the wilaya, chosen at checkout.
 */
export function DeliveryProgress({
  items,
  products,
}: {
  items: readonly CartItem[];
  products: readonly Product[];
}) {
  const known = items.filter((item) => products.some((product) => product.id === item.productId));
  const progress = getDeliveryDiscountProgress({ items: known, products });
  const hasSomething =
    progress.freeDelivery ||
    progress.amountDiscount > 0 ||
    progress.nextDeliveryDiscountTiers.length > 0;
  if (!hasSomething) return null;

  return (
    <div className="border border-line bg-paper px-4 py-3 text-[13px]" aria-live="polite">
      {progress.freeDelivery ? (
        <p className="flex items-center gap-2 font-semibold">
          <CheckIcon />
          Livraison gratuite débloquée
        </p>
      ) : (
        <>
          {progress.amountDiscount > 0 && (
            <p className="flex items-center gap-2 font-semibold">
              <CheckIcon />
              Réduction livraison : {formatDiscount(progress.amountDiscount)}
            </p>
          )}
          <ul className="space-y-1.5 text-ash [&:not(:first-child)]:mt-2">
            {progress.nextDeliveryDiscountTiers.map((next) => (
              <li key={next.productId} className="flex items-start gap-2">
                <TruckIcon width={18} height={18} className="mt-px shrink-0" />
                <span>
                  Ajoutez {next.missingQuantity} {next.productName}{" "}
                  {next.tier.type === "free"
                    ? "pour la livraison gratuite"
                    : `pour ${formatTierBenefit(next.tier)} sur la livraison`}
                  <span className="sr-only">
                    {" "}
                    (vous en avez {formatArticleCount(next.quantity)})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {progress.amountDiscount > 0 && !progress.freeDelivery && (
        <p className="mt-2 text-xs text-stone">
          Appliquée à la commande, dans la limite des frais de livraison.
        </p>
      )}
    </div>
  );
}
