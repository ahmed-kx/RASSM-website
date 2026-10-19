"use client";

import {
  CATEGORIES,
  CATEGORY_LABELS,
  DEFAULT_FILTERS,
  SORT_KEYS,
  SORT_LABELS,
  filterAndSortProducts,
  getCollectionFacets,
  parseCollectionFilters,
  serializeCollectionFilters,
  type Category,
  type CollectionFilters,
  type Product,
  type SortKey,
} from "@rassm/shared";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ProductCard, ProductListItem } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ChevronDownIcon, CloseIcon, FilterIcon, GridIcon, ListIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { FiltersPanel } from "./filters-panel";

const GRID_IMAGE_SIZES = "(min-width: 1280px) 22vw, (min-width: 768px) 31vw, 50vw";

function productCount(count: number) {
  return `${count} produit${count > 1 ? "s" : ""}`;
}

/**
 * Collection: toolbar, filter sidebar (drawer on mobile) and product grid or list.
 * Every filter lives in the URL; it is updated with history.replaceState, which Next
 * syncs with useSearchParams without a server round trip.
 */
export function CollectionView({
  products,
  afterGrid,
}: {
  products: readonly Product[];
  /** Rendered under the grid (the promo banner). */
  afterGrid?: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseCollectionFilters(searchParams), [searchParams]);
  const facets = useMemo(() => getCollectionFacets(products), [products]);
  const visible = useMemo(() => filterAndSortProducts(products, filters), [products, filters]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<CollectionFilters>) => {
      const query = serializeCollectionFilters({ ...filters, ...patch });
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [filters, pathname],
  );
  const resetFilters = useCallback(
    () => update({ ...DEFAULT_FILTERS, sort: filters.sort, view: filters.view }),
    [filters.sort, filters.view, update],
  );

  const activeCount =
    filters.categories.length +
    filters.colors.length +
    filters.sizes.length +
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0);

  return (
    <>
      <div className="border-b border-line bg-paper">
        <Container
          size="narrow"
          className="flex flex-col gap-2 py-3 lg:h-[60px] lg:flex-row lg:items-center lg:justify-between lg:py-0"
        >
          <CategoryTabs
            selected={filters.categories}
            onSelect={(categories) => update({ categories })}
          />
          <div className="flex items-center justify-between gap-4 lg:justify-end lg:gap-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-haspopup="dialog"
              className="flex h-10 items-center gap-2 text-[11px] font-semibold tracking-button uppercase lg:hidden"
            >
              <FilterIcon />
              Filtres{activeCount > 0 && ` (${activeCount})`}
            </button>
            <div className="flex items-center gap-4 lg:gap-8">
              <SortSelect value={filters.sort} onChange={(sort) => update({ sort })} />
              <ViewToggle value={filters.view} onChange={(view) => update({ view })} />
            </div>
          </div>
        </Container>
      </div>

      <Container
        size="narrow"
        className="py-6 lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-10 lg:py-5"
      >
        <aside aria-label="Filtres" className="hidden lg:block">
          <div className="sticky top-6 pt-3">
            <FiltersPanel
              idPrefix="sidebar"
              filters={filters}
              facets={facets}
              onChange={update}
              onReset={resetFilters}
            />
          </div>
        </aside>

        <div>
          <p className="sr-only" aria-live="polite">
            {productCount(visible.length)}
          </p>
          {visible.length === 0 ? (
            <EmptyState onReset={resetFilters} />
          ) : filters.view === "grid" ? (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 xl:gap-4">
              {visible.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} imageSizes={GRID_IMAGE_SIZES} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-3">
              {visible.map((product) => (
                <li key={product.id}>
                  <ProductListItem product={product} />
                </li>
              ))}
            </ul>
          )}
          {afterGrid && <div className="mt-6 lg:mt-5">{afterGrid}</div>}
        </div>
      </Container>

      {drawerOpen && (
        <FiltersDrawer resultCount={visible.length} onClose={() => setDrawerOpen(false)}>
          <FiltersPanel
            idPrefix="drawer"
            filters={filters}
            facets={facets}
            onChange={update}
            onReset={resetFilters}
          />
        </FiltersDrawer>
      )}
    </>
  );
}

const TABS: readonly { label: string; categories: Category[] }[] = [
  { label: "Tous les produits", categories: [] },
  ...CATEGORIES.map((category) => ({ label: CATEGORY_LABELS[category], categories: [category] })),
];

function CategoryTabs({
  selected,
  onSelect,
}: {
  selected: readonly Category[];
  onSelect: (categories: Category[]) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Catégories"
      className="-mx-4 flex [scrollbar-width:none] gap-6 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:gap-9 lg:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((tab) => {
        const active =
          tab.categories.length === selected.length &&
          tab.categories.every((category) => selected.includes(category));
        return (
          <button
            key={tab.label}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(tab.categories)}
            className={cn(
              "shrink-0 border-b py-2 text-xs tracking-[0.14em] whitespace-nowrap uppercase transition-colors focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink",
              active ? "border-ink text-ink" : "border-transparent text-stone hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function SortSelect({ value, onChange }: { value: SortKey; onChange: (sort: SortKey) => void }) {
  return (
    <label className="flex items-center gap-3">
      <span className="text-[10px] tracking-label text-stone uppercase">Trier par</span>
      <span className="relative">
        <select
          value={value}
          onChange={(event) => {
            const next = SORT_KEYS.find((key) => key === event.target.value);
            if (next) onChange(next);
          }}
          className="h-10 cursor-pointer appearance-none bg-transparent pr-6 text-[13px] text-ink focus-visible:outline-1 focus-visible:outline-ink"
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2" />
      </span>
    </label>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: CollectionFilters["view"];
  onChange: (view: CollectionFilters["view"]) => void;
}) {
  const button = (active: boolean) =>
    cn(
      "grid size-9 place-items-center transition-opacity focus-visible:outline-1 focus-visible:outline-ink",
      active ? "text-ink" : "text-stone opacity-60 hover:opacity-100",
    );
  return (
    <div role="group" aria-label="Affichage" className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Affichage en grille"
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
        className={button(value === "grid")}
      >
        <GridIcon />
      </button>
      <button
        type="button"
        aria-label="Affichage en liste"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
        className={button(value === "list")}
      >
        <ListIcon />
      </button>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center border border-line px-6 py-16 text-center">
      <p className="font-display text-3xl uppercase">Aucun produit trouvé</p>
      <p className="mt-3 max-w-sm text-sm text-ash">
        Aucun produit ne correspond à vos filtres. Essayez d&apos;en retirer quelques-uns.
      </p>
      <Button variant="outlined" surface="light" onClick={onReset} className="mt-8">
        Réinitialiser les filtres
      </Button>
    </div>
  );
}

/** Mobile bottom drawer holding the filters, with the live result count. */
function FiltersDrawer({
  resultCount,
  onClose,
  children,
}: {
  resultCount: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50 motion-safe:animate-fade-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtres"
        className="absolute inset-x-0 bottom-0 flex max-h-[88svh] flex-col bg-bone text-ink motion-safe:animate-slide-in-up"
      >
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-line px-4">
          <button
            ref={closeButton}
            type="button"
            aria-label="Fermer les filtres"
            onClick={onClose}
            className="grid size-10 place-items-center"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
        <div className="shrink-0 border-t border-line p-4 sm:px-6">
          <Button surface="light" onClick={onClose} className="w-full">
            Afficher {productCount(resultCount)}
          </Button>
        </div>
      </div>
    </div>
  );
}
