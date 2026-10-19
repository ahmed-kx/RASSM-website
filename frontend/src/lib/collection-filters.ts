import {
  CATEGORIES,
  CATEGORY_LABELS,
  SIZES,
  categorySchema,
  sizeSchema,
  type Category,
  type Product,
  type Size,
} from "@rassm/shared";

// Collection filters live in the URL (?category=hoodie,tshirt&color=noir&size=M&min=…&max=…&sort=…&view=…)
// so links can be shared and the homepage category cards land on the right filter.

export const SORT_KEYS = ["featured", "new", "price-asc", "price-desc"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  featured: "En vedette",
  new: "Nouveautés",
  "price-asc": "Prix croissant",
  "price-desc": "Prix décroissant",
};

export const VIEW_MODES = ["grid", "list"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export interface CollectionFilters {
  /** Empty = all categories. */
  categories: Category[];
  /** Color keys, e.g. "noir" (see `colorKey`). Empty = all colors. */
  colors: string[];
  /** Products with stock in at least one of these sizes. Empty = all sizes. */
  sizes: Size[];
  minPrice: number | null;
  maxPrice: number | null;
  sort: SortKey;
  view: ViewMode;
}

export const DEFAULT_FILTERS: CollectionFilters = {
  categories: [],
  colors: [],
  sizes: [],
  minPrice: null,
  maxPrice: null,
  sort: "featured",
  view: "grid",
};

type ParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

function getParam(input: ParamsInput, key: string): string | undefined {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseList(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
}

function parsePrice(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/** "Crème" → "creme": stable, URL-friendly key for a color name. */
export function colorKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Reads filters from the URL. Unknown or invalid values are ignored, never thrown. */
export function parseCollectionFilters(input: ParamsInput): CollectionFilters {
  const sort = getParam(input, "sort");
  const view = getParam(input, "view");
  return {
    categories: unique(
      parseList(getParam(input, "category")).flatMap((value) => {
        const parsed = categorySchema.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
    colors: unique(parseList(getParam(input, "color")).map(colorKey).filter(Boolean)),
    sizes: unique(
      parseList(getParam(input, "size")).flatMap((value) => {
        const parsed = sizeSchema.safeParse(value.toUpperCase());
        return parsed.success ? [parsed.data] : [];
      }),
    ),
    minPrice: parsePrice(getParam(input, "min")),
    maxPrice: parsePrice(getParam(input, "max")),
    sort: SORT_KEYS.find((key) => key === sort) ?? DEFAULT_FILTERS.sort,
    view: VIEW_MODES.find((mode) => mode === view) ?? DEFAULT_FILTERS.view,
  };
}

/** Builds the query string (without "?"), leaving out default values. */
export function serializeCollectionFilters(filters: CollectionFilters): string {
  const params = new URLSearchParams();
  const ordered = <T extends string>(values: T[], order: readonly T[]) =>
    order.filter((value) => values.includes(value));
  if (filters.categories.length) {
    params.set("category", ordered(filters.categories, CATEGORIES).join(","));
  }
  if (filters.colors.length) params.set("color", [...filters.colors].sort().join(","));
  if (filters.sizes.length) params.set("size", ordered(filters.sizes, SIZES).join(","));
  if (filters.minPrice !== null) params.set("min", String(filters.minPrice));
  if (filters.maxPrice !== null) params.set("max", String(filters.maxPrice));
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.view !== DEFAULT_FILTERS.view) params.set("view", filters.view);
  // Keep commas readable in shared links.
  return params.toString().replace(/%2C/g, ",");
}

/** True when a filter (not sort or view) narrows the list. */
export function hasActiveFilters(filters: CollectionFilters): boolean {
  return (
    filters.categories.length > 0 ||
    filters.colors.length > 0 ||
    filters.sizes.length > 0 ||
    filters.minPrice !== null ||
    filters.maxPrice !== null
  );
}

export interface CollectionFacets {
  total: number;
  categories: { category: Category; label: string; count: number }[];
  colors: { key: string; name: string; hex: string; count: number }[];
  /** Sizes in stock in at least one product, in S → XXL order. */
  sizes: Size[];
  price: { min: number; max: number };
}

/** Counts for the filter sidebar, computed on the whole catalog. */
export function getCollectionFacets(products: readonly Product[]): CollectionFacets {
  const colors = new Map<string, { key: string; name: string; hex: string; count: number }>();
  for (const product of products) {
    for (const color of product.colors) {
      const key = colorKey(color.name);
      const entry = colors.get(key) ?? { key, name: color.name, hex: color.hex, count: 0 };
      entry.count += 1;
      colors.set(key, entry);
    }
  }
  const prices = products.map((product) => product.price);
  return {
    total: products.length,
    categories: CATEGORIES.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      count: products.filter((product) => product.category === category).length,
    })),
    colors: [...colors.values()].sort((a, b) => b.count - a.count),
    sizes: SIZES.filter((size) => products.some((product) => product.stock[size] > 0)),
    price: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
  };
}

const compareBySort: Record<SortKey, (a: Product, b: Product) => number> = {
  // Featured products first, then the catalog order.
  featured: (a, b) => Number(b.featured) - Number(a.featured),
  new: (a, b) => b.createdAt.localeCompare(a.createdAt),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
};

export function filterAndSortProducts(
  products: readonly Product[],
  filters: CollectionFilters,
): Product[] {
  return products
    .filter(
      (product) =>
        (filters.categories.length === 0 || filters.categories.includes(product.category)) &&
        (filters.colors.length === 0 ||
          product.colors.some((color) => filters.colors.includes(colorKey(color.name)))) &&
        (filters.sizes.length === 0 || filters.sizes.some((size) => product.stock[size] > 0)) &&
        (filters.minPrice === null || product.price >= filters.minPrice) &&
        (filters.maxPrice === null || product.price <= filters.maxPrice),
    )
    .sort(compareBySort[filters.sort]);
}
