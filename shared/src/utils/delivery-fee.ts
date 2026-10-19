import type {
  DeliveryDiscountLine,
  DeliveryDiscountTier,
  NextDeliveryDiscountTier,
} from "../schemas/delivery-discount";
import { getDeliveryPrice, type DeliveryFee, type DeliveryType } from "../schemas/delivery";
import type { Product } from "../schemas/product";

/** The product fields the calculation needs. */
export type DeliveryDiscountProduct = Pick<
  Product,
  "id" | "name" | "category" | "deliveryDiscountTiers"
>;

export interface DeliveryFeeInput {
  wilayaCode: number;
  deliveryType: DeliveryType;
  /**
   * Ordered lines: only product id and quantity are read. An order from the product
   * page has one line; lines of the same product add up (e.g. several sizes).
   */
  items: readonly { productId: string; quantity: number }[];
  /**
   * The ordered products, with their tiers. The backend passes products loaded from the
   * database, never data sent by the client.
   */
  products: readonly DeliveryDiscountProduct[];
  /** Delivery fee table (mock data now, the database later). */
  deliveryFees: readonly DeliveryFee[];
}

/** Delivery fee split. The first five fields have the same names as on the Order. */
export interface DeliveryFeeBreakdown {
  /** Fee for the wilaya and delivery type, before any discount. */
  deliveryFeeBase: number;
  /** Discount actually applied: capped at the base fee. */
  deliveryDiscount: number;
  /** What the customer pays for delivery, never below 0. */
  deliveryFee: number;
  /** True when at least one product reached a "free" tier. */
  freeDelivery: boolean;
  /** One line per product whose tier applies. */
  deliveryDiscountLines: DeliveryDiscountLine[];
  /** Better tiers not reached yet (empty once delivery costs 0). */
  nextDeliveryDiscountTiers: NextDeliveryDiscountTier[];
}

/** Ranks tiers: free delivery beats any amount. */
function tierValue(tier: DeliveryDiscountTier | undefined): number {
  if (!tier) return 0;
  return tier.type === "free" ? Number.POSITIVE_INFINITY : tier.amount;
}

/** The tier with the highest minQuantity that is <= quantity, if any. */
export function getApplicableTier(
  tiers: readonly DeliveryDiscountTier[],
  quantity: number,
): DeliveryDiscountTier | undefined {
  return tiers
    .filter((tier) => tier.minQuantity <= quantity)
    .reduce<DeliveryDiscountTier | undefined>(
      (best, tier) => (!best || tier.minQuantity > best.minQuantity ? tier : best),
      undefined,
    );
}

/** The closest tier above `quantity` that gives more than the current one, if any. */
export function getNextBetterTier(
  tiers: readonly DeliveryDiscountTier[],
  quantity: number,
): DeliveryDiscountTier | undefined {
  const currentValue = tierValue(getApplicableTier(tiers, quantity));
  return tiers
    .filter((tier) => tier.minQuantity > quantity && tierValue(tier) > currentValue)
    .reduce<DeliveryDiscountTier | undefined>(
      (closest, tier) => (!closest || tier.minQuantity < closest.minQuantity ? tier : closest),
      undefined,
    );
}

/**
 * The single source of truth for the delivery fee, used by the frontend (display)
 * and the backend (which recalculates it and never trusts the client).
 *
 * Rules:
 * - quantities of the same product add up across sizes;
 * - each product uses its tier with the highest minQuantity <= its quantity;
 * - any "free" tier makes the whole delivery free;
 * - otherwise the amounts of all products add up;
 * - the discount is capped at the base fee, so the final fee never goes below 0.
 *
 * Throws `DeliveryTypeUnavailableError` (French message) for stop desk in a wilaya
 * without one, and a plain Error for an unknown wilaya or product.
 */
export function getDeliveryFeeWithDiscount({
  wilayaCode,
  deliveryType,
  items,
  products,
  deliveryFees,
}: DeliveryFeeInput): DeliveryFeeBreakdown {
  const fee = deliveryFees.find((entry) => entry.wilayaCode === wilayaCode);
  if (!fee) {
    throw new Error(`Aucun tarif de livraison pour la wilaya ${wilayaCode}.`);
  }
  const deliveryFeeBase = getDeliveryPrice(fee, deliveryType);
  const orderedProducts = groupProducts(items, products);

  const deliveryDiscountLines: DeliveryDiscountLine[] = getAppliedTiers(orderedProducts).map(
    (applied) => ({
      ...applied,
      amount: applied.tier.type === "free" ? deliveryFeeBase : applied.tier.amount,
    }),
  );

  const freeDelivery = deliveryDiscountLines.some((line) => line.tier.type === "free");
  const amountsTotal = deliveryDiscountLines.reduce((sum, line) => sum + line.amount, 0);
  const deliveryDiscount = freeDelivery ? deliveryFeeBase : Math.min(amountsTotal, deliveryFeeBase);
  const deliveryFee = deliveryFeeBase - deliveryDiscount;

  return {
    deliveryFeeBase,
    deliveryDiscount,
    deliveryFee,
    freeDelivery,
    deliveryDiscountLines,
    nextDeliveryDiscountTiers: deliveryFee > 0 ? getNextTiers(orderedProducts) : [],
  };
}

/** A tier reached by one ordered product, before any delivery fee is known. */
export interface AppliedDeliveryDiscountTier {
  productId: string;
  productName: string;
  quantity: number;
  tier: DeliveryDiscountTier;
}

export interface DeliveryDiscountProgress {
  /** True when at least one product reached a "free" tier. */
  freeDelivery: boolean;
  /** Sum of the "amount" tiers reached. The cap at the base fee is applied once the wilaya is known. */
  amountDiscount: number;
  appliedTiers: AppliedDeliveryDiscountTier[];
  /** Better tiers not reached yet (empty once delivery is free). */
  nextDeliveryDiscountTiers: NextDeliveryDiscountTier[];
}

/**
 * The same tier rules as `getDeliveryFeeWithDiscount`, without a wilaya: what the
 * quantity has unlocked so far and what the next tiers would give. Used by the order
 * summary before the customer chooses a wilaya.
 */
export function getDeliveryDiscountProgress({
  items,
  products,
}: Pick<DeliveryFeeInput, "items" | "products">): DeliveryDiscountProgress {
  const orderedProducts = groupProducts(items, products);
  const appliedTiers = getAppliedTiers(orderedProducts);
  const freeDelivery = appliedTiers.some((applied) => applied.tier.type === "free");
  const amountDiscount = appliedTiers.reduce(
    (sum, { tier }) => sum + (tier.type === "amount" ? tier.amount : 0),
    0,
  );
  return {
    freeDelivery,
    amountDiscount,
    appliedTiers,
    nextDeliveryDiscountTiers: freeDelivery ? [] : getNextTiers(orderedProducts),
  };
}

interface OrderedProduct {
  product: DeliveryDiscountProduct;
  quantity: number;
}

/** One entry per distinct product, quantities added up across sizes, in order. */
function groupProducts(
  items: DeliveryFeeInput["items"],
  products: DeliveryFeeInput["products"],
): OrderedProduct[] {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  return [...quantities].map(([productId, quantity]) => {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) {
      throw new Error(`Produit inconnu : ${productId}.`);
    }
    return { product, quantity };
  });
}

function getAppliedTiers(
  orderedProducts: readonly OrderedProduct[],
): AppliedDeliveryDiscountTier[] {
  return orderedProducts.flatMap(({ product, quantity }) => {
    const tier = getApplicableTier(product.deliveryDiscountTiers, quantity);
    return tier ? [{ productId: product.id, productName: product.name, quantity, tier }] : [];
  });
}

function getNextTiers(orderedProducts: readonly OrderedProduct[]): NextDeliveryDiscountTier[] {
  return orderedProducts.flatMap(({ product, quantity }) => {
    const tier = getNextBetterTier(product.deliveryDiscountTiers, quantity);
    return tier
      ? [
          {
            productId: product.id,
            productName: product.name,
            category: product.category,
            quantity,
            missingQuantity: tier.minQuantity - quantity,
            tier,
          },
        ]
      : [];
  });
}

/** Highest home delivery price in the table: tier amounts must stay below it. */
export function getMaxHomeDeliveryPrice(deliveryFees: readonly DeliveryFee[]): number {
  return Math.max(0, ...deliveryFees.map((fee) => fee.homePrice));
}
