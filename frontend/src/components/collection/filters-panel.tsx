"use client";

import { hasActiveFilters, type CollectionFacets, type CollectionFilters } from "@rassm/shared";
import type { ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/section-label";
import { PriceRange } from "./price-range";

function toggle<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group border-t border-line py-1 first-of-type:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-[11px] font-semibold tracking-label uppercase focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDownIcon className="transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

function Checkbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 py-1 text-[13px]">
      <span className="relative inline-grid size-4 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer size-4 cursor-pointer appearance-none border border-ink/60 checked:border-ink checked:bg-ink focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
        <CheckIcon
          width={12}
          height={12}
          className="pointer-events-none absolute inset-0 m-auto hidden text-paper peer-checked:block"
        />
      </span>
      {children}
    </label>
  );
}

/** Sidebar filters (desktop) and content of the mobile filter drawer. */
export function FiltersPanel({
  idPrefix,
  filters,
  facets,
  onChange,
  onReset,
}: {
  /** Makes ids unique when the panel is rendered twice (sidebar + mobile drawer). */
  idPrefix: string;
  filters: CollectionFilters;
  facets: CollectionFacets;
  onChange: (patch: Partial<CollectionFilters>) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between pb-3">
        <SectionLabel as="h2">Filtres</SectionLabel>
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-ash underline underline-offset-4 hover:text-ink"
          >
            Réinitialiser
          </button>
        )}
      </div>

      <FilterGroup title="Catégorie">
        <Checkbox
          id={`${idPrefix}-category-all`}
          checked={filters.categories.length === 0}
          onChange={() => onChange({ categories: [] })}
        >
          Tous les produits ({facets.total})
        </Checkbox>
        {facets.categories.map(({ category, label, count }) => (
          <Checkbox
            key={category}
            id={`${idPrefix}-category-${category}`}
            checked={filters.categories.includes(category)}
            onChange={() => onChange({ categories: toggle(filters.categories, category) })}
          >
            {label} ({count})
          </Checkbox>
        ))}
      </FilterGroup>

      <FilterGroup title="Couleur">
        <ul className="space-y-1">
          {facets.colors.map((color) => {
            const id = `${idPrefix}-color-${color.key}`;
            return (
              <li key={color.key}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-3 py-1 text-[13px]"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={filters.colors.includes(color.key)}
                    onChange={() => onChange({ colors: toggle(filters.colors, color.key) })}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="size-5 shrink-0 rounded-full border border-ink/25 ring-ink ring-offset-2 ring-offset-bone peer-checked:ring-1 peer-focus-visible:outline-1 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink"
                    // The swatch color comes from the product data.
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="peer-checked:font-semibold">
                    {color.name} ({color.count})
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      <FilterGroup title="Taille">
        <div className="flex flex-wrap gap-1">
          {facets.sizes.map((size) => {
            const id = `${idPrefix}-size-${size}`;
            return (
              <label key={size} htmlFor={id} className="cursor-pointer">
                <input
                  id={id}
                  type="checkbox"
                  checked={filters.sizes.includes(size)}
                  onChange={() => onChange({ sizes: toggle(filters.sizes, size) })}
                  className="peer sr-only"
                />
                <span className="grid h-7 min-w-8 place-items-center border border-ink/30 px-1.5 text-[11px] transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink hover:border-ink">
                  {size}
                </span>
              </label>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Prix">
        <PriceRange
          idPrefix={idPrefix}
          bounds={facets.price}
          min={filters.minPrice}
          max={filters.maxPrice}
          onChange={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
        />
      </FilterGroup>
    </div>
  );
}
