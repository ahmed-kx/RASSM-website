"use client";

import { formatPrice, type AdminSearchResult } from "@rassm/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeftIcon, SearchIcon } from "@/components/ui/icons";
import { formatPhone } from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { cn } from "@/lib/cn";
import { searchDashboard } from "@/lib/data/admin";
import { InitialAvatar, adminLabel } from "./admin-ui";
import { StatusBadge } from "./badges";

// Global search of the top bar: orders (name, phone, internal number) and products, grouped.
// Arrow keys move through the results, Enter opens one, Escape closes.

const PLACEHOLDER = "Rechercher une commande, un client, un produit…";

interface Hit {
  key: string;
  href: string;
}

function hitsOf(data: AdminSearchResult | undefined, q: string): Hit[] {
  if (!data) return [];
  return [
    ...data.orders.map((order) => ({ key: `o-${order.id}`, href: adminRoutes.order(order.id) })),
    ...data.products.map((product) => ({
      key: `p-${product.id}`,
      href: adminRoutes.product(product.id),
    })),
    {
      key: "all",
      href: `${adminRoutes.orders}?${new URLSearchParams({ statut: "all", q })}`,
    },
  ];
}

function useSearch(text: string) {
  const [debounced, setDebounced] = useState(text.trim());
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const enabled = debounced.length >= 2;
  const query = useQuery({
    queryKey: ["admin", "search", debounced],
    queryFn: ({ signal }) => searchDashboard(debounced, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
  return { ...query, q: debounced, enabled };
}

function Results({
  data,
  q,
  isFetching,
  isError,
  activeKey,
  listId,
  optionId,
  onPick,
}: {
  data: AdminSearchResult | undefined;
  q: string;
  isFetching: boolean;
  isError: boolean;
  activeKey: string | null;
  listId: string;
  optionId: (key: string) => string;
  onPick: (hit: Hit) => void;
}) {
  if (isError) {
    return <p className="px-4 py-5 text-sm text-error">La recherche n&apos;a pas abouti.</p>;
  }
  if (!data) {
    return <p className="px-4 py-5 text-sm text-stone">Recherche…</p>;
  }
  const hits = hitsOf(data, q);
  const option = (hit: Hit) => ({
    id: optionId(hit.key),
    role: "option" as const,
    "aria-selected": activeKey === hit.key,
    onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
    onClick: () => onPick(hit),
    className: cn(
      "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left",
      activeKey === hit.key ? "bg-cream" : "hover:bg-cream/60",
    ),
  });
  const empty = data.orders.length === 0 && data.products.length === 0;
  return (
    <div id={listId} role="listbox" aria-label="Résultats de la recherche" aria-busy={isFetching}>
      {empty && (
        <p className="px-4 py-5 text-sm text-stone">Aucun résultat pour «&nbsp;{q}&nbsp;».</p>
      )}
      {data.orders.length > 0 && (
        <div role="group" aria-label="Commandes" className="py-1.5">
          <p className={cn(adminLabel, "px-4 py-2")}>Commandes</p>
          {data.orders.map((order, index) => {
            const hit = hits[index];
            if (!hit) return null;
            return (
              <div key={hit.key} {...option(hit)}>
                <InitialAvatar name={order.fullName} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold">{order.fullName}</span>
                    <span className="shrink-0 text-xs text-stone">{order.orderNumber}</span>
                  </span>
                  <span className="block truncate text-xs text-ash">
                    {formatPhone(order.phone)} · {order.productName} · {formatPrice(order.total)}
                  </span>
                </span>
                <StatusBadge status={order.status} className="shrink-0" />
              </div>
            );
          })}
        </div>
      )}
      {data.products.length > 0 && (
        <div role="group" aria-label="Produits" className="border-t border-line py-1.5">
          <p className={cn(adminLabel, "px-4 py-2")}>Produits</p>
          {data.products.map((product, index) => {
            const hit = hits[data.orders.length + index];
            if (!hit) return null;
            return (
              <div key={hit.key} {...option(hit)}>
                <span className="relative size-9 shrink-0 overflow-hidden rounded-sm bg-cream">
                  {product.image && (
                    <Image
                      src={product.image}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-contain"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{product.name}</span>
                  <span className="block text-xs text-ash">
                    {formatPrice(product.price)} · {product.stock} en stock
                    {product.isActive ? "" : " · masqué"}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-stone">{product.sku}</span>
              </div>
            );
          })}
        </div>
      )}
      {(() => {
        const all = hits.at(-1);
        return all ? (
          <div {...option(all)} className={cn(option(all).className, "border-t border-line")}>
            <SearchIcon width={16} height={16} className="text-stone" />
            <span className="text-sm">Toutes les commandes pour «&nbsp;{q}&nbsp;»</span>
          </div>
        ) : null;
      })()}
    </div>
  );
}

/** Input + results. "bar": dropdown under the input (computers). "sheet": full screen (phones). */
function SearchBox({ variant, onClose }: { variant: "bar" | "sheet"; onClose?: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(variant === "sheet");
  const [active, setActive] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const baseId = useId();
  const optionId = (key: string) => `${baseId}-${key}`;
  const search = useSearch(text);
  const hits = search.enabled ? hitsOf(search.data, search.q) : [];
  const open = focused && text.trim().length >= 2;

  useEffect(() => {
    if (variant === "sheet") input.current?.focus();
  }, [variant]);
  useEffect(() => setActive(null), [search.data]);

  const pick = (hit: Hit) => {
    router.push(hit.href);
    setText("");
    setFocused(false);
    input.current?.blur();
    onClose?.();
  };

  const move = (step: number) => {
    if (hits.length === 0) return;
    const index = hits.findIndex((hit) => hit.key === active);
    const next = (index + step + hits.length) % hits.length;
    setActive(index === -1 && step < 0 ? (hits.at(-1)?.key ?? null) : (hits[next]?.key ?? null));
  };

  return (
    <div className={cn("relative", variant === "bar" && "w-full max-w-xl")}>
      <label className="relative block">
        <span className="sr-only">{PLACEHOLDER}</span>
        <SearchIcon
          width={18}
          height={18}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone"
        />
        <input
          ref={input}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active ? optionId(active) : undefined}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => variant === "bar" && setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              move(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              move(-1);
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              const hit = hits.find((item) => item.key === active) ?? hits.at(-1);
              if (hit) pick(hit);
            } else if (event.key === "Escape") {
              if (text) setText("");
              else onClose?.();
            }
          }}
          placeholder={PLACEHOLDER}
          className={cn(
            "w-full rounded-sm border border-line pr-3 pl-10 placeholder:text-stone focus:border-ink focus:outline-none",
            variant === "bar" ? "h-10 bg-paper/70 text-sm" : "h-11 bg-paper text-[15px]",
          )}
        />
      </label>
      {open && (
        <div
          className={cn(
            "text-ink",
            variant === "bar"
              ? "absolute top-full right-0 left-0 z-40 mt-2 max-h-[70svh] overflow-y-auto rounded-md border border-line bg-paper shadow-[0_18px_40px_-18px_rgb(17_17_17/0.45)]"
              : "-mx-4 mt-3 border-y border-line bg-paper",
          )}
        >
          <Results
            data={search.data}
            q={search.q}
            isFetching={search.isFetching}
            isError={search.isError}
            activeKey={active}
            listId={listId}
            optionId={optionId}
            onPick={pick}
          />
        </div>
      )}
    </div>
  );
}

/** Top bar of computers. */
export function GlobalSearchBar() {
  return <SearchBox variant="bar" />;
}

/** Phones: a search button opening a full-screen search. */
export function MobileSearchButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <button
        type="button"
        aria-label="Rechercher"
        onClick={() => setOpen(true)}
        className={className}
      >
        <SearchIcon />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rechercher"
          className="fixed inset-0 z-50 overflow-y-auto bg-bone px-4 pt-3 pb-8 text-ink motion-safe:animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Fermer la recherche"
              onClick={() => setOpen(false)}
              className="-ml-2 grid size-11 shrink-0 place-items-center"
            >
              <ChevronLeftIcon />
            </button>
            <div className="min-w-0 flex-1">
              <SearchBox variant="sheet" onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
