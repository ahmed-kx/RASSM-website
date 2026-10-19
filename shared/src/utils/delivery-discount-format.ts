import type { DeliveryDiscountTier, NextDeliveryDiscountTier } from "../schemas/delivery-discount";
import { formatPrice } from "./format-price";

const MINUS = "−";

/** "1 article", "3 articles" */
export function formatArticleCount(count: number): string {
  return `${count} article${count > 1 ? "s" : ""}`;
}

/** What one tier gives, in French: "−100 DA" or "livraison gratuite". */
export function formatTierBenefit(tier: DeliveryDiscountTier): string {
  return tier.type === "free" ? "livraison gratuite" : `${MINUS}${formatPrice(tier.amount)}`;
}

/** A discount amount for display: "−150 DA". */
export function formatDiscount(amount: number): string {
  return `${MINUS}${formatPrice(amount)}`;
}

/**
 * A product's tiers as one French line, sorted by quantity:
 * "1 article : −100 DA · 2 articles : −200 DA · 3 articles : livraison gratuite".
 * Empty string when the product has no tiers.
 */
export function formatDeliveryDiscountTiers(tiers: readonly DeliveryDiscountTier[]): string {
  return [...tiers]
    .sort((a, b) => a.minQuantity - b.minQuantity)
    .map((tier) => `${formatArticleCount(tier.minQuantity)} : ${formatTierBenefit(tier)}`)
    .join(" · ");
}

/**
 * The next-tier hint under the order summary:
 * "Ajoutez 1 article pour la livraison gratuite" or "Ajoutez 2 articles pour −200 DA sur la livraison".
 */
export function formatNextTierMessage(
  next: Pick<NextDeliveryDiscountTier, "missingQuantity" | "tier">,
): string {
  const benefit =
    next.tier.type === "free"
      ? "la livraison gratuite"
      : `${formatDiscount(next.tier.amount)} sur la livraison`;
  return `Ajoutez ${formatArticleCount(next.missingQuantity)} pour ${benefit}`;
}
