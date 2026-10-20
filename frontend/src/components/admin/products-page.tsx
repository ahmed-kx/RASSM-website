"use client";

import {
  CATEGORY_LABELS,
  PRODUCT_SORTS,
  PRODUCT_SORT_LABELS,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  PRODUCT_TABS,
  DEFAULT_LOW_STOCK_THRESHOLD,
  formatPrice,
  getStockLevel,
  type AdminProductRow,
  type ProductSort,
  type ProductStatus,
  type ProductTab,
} from "@rassm/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BoxIcon,
  CheckIcon,
  CoinsIcon,
  CopyIcon,
  EditIcon,
  LayersIcon,
  MoreIcon,
  OrdersIcon,
  PlusIcon,
  SearchIcon,
  SlidersIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  deleteAdminProduct,
  duplicateAdminProduct,
  fetchAdminProducts,
  setProductFlags,
} from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { AdminMenu } from "./admin-top-bar";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminSelect,
  KpiCard,
  Pagination,
  adminInput,
  adminLabel,
  buttonClass,
} from "./admin-ui";
import { ProductStatusBadge, StockLevel } from "./badges";
import { LowStockDialog } from "./low-stock-dialog";
import { StockGridDialog } from "./stock-grid-dialog";
import { useToast } from "./toasts";

const DEFAULT_PAGE_SIZE = 10;

const TAB_LABELS: Record<ProductTab, string> = { all: "Tous", ...CATEGORY_LABELS };

interface Filters {
  category: ProductTab;
  q: string;
  status: ProductStatus | "all";
  drop: string;
  sort: ProductSort;
  page: number;
  pageSize: number;
}

function readFilters(params: URLSearchParams): Filters {
  const positive = (value: string | null, fallback: number) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  };
  const pick = <T extends string>(list: readonly T[], value: string | null, fallback: T) =>
    list.find((item) => item === value) ?? fallback;
  return {
    category: pick(PRODUCT_TABS, params.get("categorie"), "all"),
    q: params.get("q") ?? "",
    status: pick([...PRODUCT_STATUSES, "all"] as const, params.get("statut"), "all"),
    drop: params.get("drop") ?? "",
    sort: pick(PRODUCT_SORTS, params.get("tri"), "newest"),
    page: positive(params.get("page"), 1),
    pageSize: positive(params.get("par"), DEFAULT_PAGE_SIZE),
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;
const number = (value: number) => value.toLocaleString("fr-FR").replace(/\s/g, " ");

export function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stockFor, setStockFor] = useState<AdminProductRow | null>(null);
  const [toDelete, setToDelete] = useState<AdminProductRow | null>(null);
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const setFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, page: 1, ...patch };
    const query = new URLSearchParams();
    if (next.category !== "all") query.set("categorie", next.category);
    if (next.q) query.set("q", next.q);
    if (next.status !== "all") query.set("statut", next.status);
    if (next.drop) query.set("drop", next.drop);
    if (next.sort !== "newest") query.set("tri", next.sort);
    if (next.page > 1) query.set("page", String(next.page));
    if (next.pageSize !== DEFAULT_PAGE_SIZE) query.set("par", String(next.pageSize));
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (search.trim() === filters.q) return;
    const timer = setTimeout(() => setFilters({ q: search.trim() }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text changes
  }, [search]);

  const query = useQuery({
    queryKey: ["admin", "products", filters],
    queryFn: () =>
      fetchAdminProducts({
        category: filters.category,
        q: filters.q || undefined,
        status: filters.status,
        drop: filters.drop || undefined,
        sort: filters.sort,
        page: filters.page,
        limit: filters.pageSize,
      }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const products = data?.products ?? [];
  const lowStockThreshold = data?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
  const fail = (title: string) => (error: unknown) =>
    showToast({
      title,
      message: error instanceof ApiError ? error.message : undefined,
      tone: "error",
    });

  const flags = useMutation({
    mutationFn: ({
      ids,
      change,
    }: {
      ids: string[];
      change: { isActive?: boolean; featured?: boolean };
    }) => Promise.all(ids.map((id) => setProductFlags(id, change))),
    onSuccess: (_result, { ids, change }) => {
      void refresh();
      setSelected(new Set());
      const what =
        change.isActive === undefined
          ? change.featured
            ? "mis en avant"
            : "retiré des produits mis en avant"
          : change.isActive
            ? "visible sur le site"
            : "masqué";
      showToast({
        title: ids.length > 1 ? `${ids.length} produits : ${what}` : `Produit ${what}`,
        tone: "success",
      });
    },
    onError: fail("Modification impossible"),
  });

  const duplicate = useMutation({
    mutationFn: duplicateAdminProduct,
    onSuccess: (detail) => {
      void refresh();
      showToast({
        title: "Copie créée (masquée)",
        message: `${detail.product.name} · ${detail.product.sku}`,
        href: adminRoutes.product(detail.product.id),
        tone: "success",
      });
    },
    onError: fail("Duplication impossible"),
  });

  const remove = useMutation({
    mutationFn: deleteAdminProduct,
    onSuccess: () => {
      void refresh();
      setToDelete(null);
      showToast({ title: "Produit supprimé", tone: "success" });
    },
    onError: (error) => {
      setToDelete(null);
      fail("Suppression impossible")(error);
    },
  });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOnPage = products.length > 0 && products.every((product) => selected.has(product.id));
  const togglePage = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const product of products) {
        if (allOnPage) next.delete(product.id);
        else next.add(product.id);
      }
      return next;
    });

  const hasFilters = Boolean(filters.q || filters.status !== "all" || filters.drop);

  return (
    <>
      <AdminPageHeader
        title="Produits"
        count={data ? plural(data.kpis.products.value, "produit") : undefined}
        subtitle="Votre catalogue, ses photos et son stock"
        actions={
          <>
            <button
              type="button"
              onClick={() => setThresholdOpen(true)}
              className={buttonClass("outline", "h-12", "plain")}
            >
              <SlidersIcon width={18} height={18} /> Seuil de stock faible
            </button>
            <Link href={adminRoutes.newProduct} className={buttonClass("primary", "h-12", "plain")}>
              <PlusIcon width={18} height={18} /> Ajouter un produit
            </Link>
          </>
        }
      />

      {/* KPI cards */}
      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={OrdersIcon}
          label="Produits"
          value={data ? number(data.kpis.products.value) : "·"}
          trend={data?.kpis.products.trend}
        />
        <KpiCard
          icon={LayersIcon}
          label="Drops"
          value={data ? number(data.kpis.drops.value) : "·"}
          trend={data?.kpis.drops.trend}
        />
        <KpiCard
          icon={BoxIcon}
          label="Stock total"
          value={data ? number(data.kpis.stockUnits.value) : "·"}
          trend={data?.kpis.stockUnits.trend}
        />
        <KpiCard
          icon={CoinsIcon}
          label="Valeur du stock"
          value={data ? formatPrice(data.kpis.stockValue.value) : "·"}
          trend={data?.kpis.stockValue.trend}
        />
      </div>

      {/* Category tabs, search, filters and sort */}
      <div className="mt-6 flex flex-col gap-3 2xl:flex-row 2xl:items-center">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 2xl:pb-0">
          <div
            role="tablist"
            aria-label="Catégories"
            className="flex w-max overflow-hidden rounded-sm border border-line bg-paper"
          >
            {PRODUCT_TABS.map((tab) => {
              const active = tab === filters.category;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilters({ category: tab })}
                  className={cn(
                    "flex h-11 items-center gap-2.5 border-r border-line px-5 text-sm whitespace-nowrap last:border-r-0",
                    active ? "bg-ink text-paper" : "text-ink hover:bg-cream/60",
                  )}
                >
                  {TAB_LABELS[tab]}
                  <span className={cn("text-xs tabular-nums", active ? "text-mist" : "text-stone")}>
                    {data?.counts[tab] ?? "·"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:flex-wrap 2xl:justify-end">
          <label className="relative col-span-2 sm:min-w-56 sm:flex-1 2xl:max-w-72">
            <span className="sr-only">Rechercher un produit</span>
            <SearchIcon
              width={18}
              height={18}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone"
            />
            <input
              type="text"
              inputMode="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un produit…"
              className={cn(adminInput, "pl-10 text-sm")}
            />
          </label>
          <AdminSelect
            label="Statut"
            value={filters.status}
            onChange={(value) => setFilters({ status: value as Filters["status"] })}
            options={[
              { value: "all", label: "Statut : tous" },
              ...PRODUCT_STATUSES.map((status) => ({
                value: status,
                label: PRODUCT_STATUS_LABELS[status],
              })),
            ]}
          />
          <AdminSelect
            label="Drop"
            value={filters.drop}
            onChange={(drop) => setFilters({ drop })}
            options={[
              { value: "", label: "Drop : tous" },
              ...(data?.drops ?? []).map((drop) => ({ value: drop, label: drop })),
            ]}
          />
          <AdminSelect
            label="Trier par"
            value={filters.sort}
            onChange={(sort) => setFilters({ sort: sort as ProductSort })}
            className="col-span-2 sm:col-span-1"
            options={PRODUCT_SORTS.map((sort) => ({
              value: sort,
              label: `Trier : ${PRODUCT_SORT_LABELS[sort].toLowerCase()}`,
            }))}
          />
        </div>
      </div>

      {/* Table (cards on a phone) */}
      <div className="mt-4">
        {query.isPending ? (
          <AdminEmpty>Chargement des produits…</AdminEmpty>
        ) : query.isError ? (
          <AdminEmpty tone="error">
            {query.error instanceof ApiError
              ? query.error.message
              : "Impossible de charger les produits."}
          </AdminEmpty>
        ) : products.length === 0 ? (
          <AdminEmpty>
            {hasFilters || filters.category !== "all"
              ? "Aucun produit ne correspond à ces filtres."
              : "Aucun produit pour le moment."}
          </AdminEmpty>
        ) : (
          <div className="lg:overflow-hidden lg:rounded-md lg:border lg:border-line lg:bg-paper">
            <div
              className={cn(
                ROW_GRID,
                "hidden h-12 items-center border-b border-line px-5 lg:grid",
                adminLabel,
              )}
            >
              <label className="flex">
                <span className="sr-only">Tout sélectionner sur cette page</span>
                <input
                  type="checkbox"
                  checked={allOnPage}
                  onChange={togglePage}
                  className="size-4.5 accent-ink"
                />
              </label>
              <span>Produit</span>
              <span>Collection</span>
              <span>Prix</span>
              <span>Stock</span>
              <span>Statut</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className={cn("space-y-2.5 lg:space-y-0", query.isPlaceholderData && "opacity-60")}>
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  lowStockThreshold={lowStockThreshold}
                  selected={selected.has(product.id)}
                  onToggle={() => toggle(product.id)}
                  onStock={() => setStockFor(product)}
                  onDuplicate={() => duplicate.mutate(product.id)}
                  onFlags={(change) => flags.mutate({ ids: [product.id], change })}
                  onDelete={() => setToDelete(product)}
                />
              ))}
            </ul>
          </div>
        )}
        {data && data.total > 0 && (
          <Pagination
            page={filters.page}
            pageSize={filters.pageSize}
            total={data.total}
            unit="produits"
            onPage={(page) => setFilters({ page })}
            onPageSize={(pageSize) => setFilters({ pageSize })}
          />
        )}
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-4 flex flex-wrap items-center gap-2 rounded-md bg-onyx p-3 text-paper shadow-[0_18px_40px_-18px_rgb(17_17_17/0.6)] lg:bottom-5">
          <p className="mr-auto pl-1 text-sm">
            {plural(selected.size, "produit")} sélectionné{selected.size > 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="min-h-11 px-2 text-sm text-mist underline underline-offset-4 hover:text-paper"
          >
            Désélectionner
          </button>
          <button
            type="button"
            disabled={flags.isPending}
            onClick={() => flags.mutate({ ids: [...selected], change: { isActive: false } })}
            className={buttonClass("onDarkOutline")}
          >
            Masquer
          </button>
          <button
            type="button"
            disabled={flags.isPending}
            onClick={() => flags.mutate({ ids: [...selected], change: { isActive: true } })}
            className={buttonClass("onDarkPrimary")}
          >
            Afficher sur le site
          </button>
        </div>
      )}

      <LowStockDialog
        open={thresholdOpen}
        current={lowStockThreshold}
        onClose={() => setThresholdOpen(false)}
      />

      {stockFor && (
        <StockGridDialog
          productId={stockFor.id}
          productName={stockFor.name}
          onClose={() => setStockFor(null)}
        />
      )}

      <AdminDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={
          toDelete && toDelete.orderCount > 0 ? "Suppression impossible" : "Supprimer ce produit ?"
        }
      >
        {toDelete && toDelete.orderCount > 0 ? (
          <>
            <p className="text-[15px] leading-relaxed text-ash">
              «&nbsp;{toDelete.name}&nbsp;» a {plural(toDelete.orderCount, "commande")} : il ne peut
              pas être supprimé, pour que les commandes gardent leurs informations. Vous pouvez le
              masquer : il disparaît du site.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!toDelete.isActive || flags.isPending}
                onClick={() => {
                  flags.mutate({ ids: [toDelete.id], change: { isActive: false } });
                  setToDelete(null);
                }}
                className={buttonClass("primary", "h-12")}
              >
                {toDelete.isActive ? "Masquer le produit" : "Déjà masqué"}
              </button>
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className={buttonClass("outline", "h-12")}
              >
                Retour
              </button>
            </div>
          </>
        ) : toDelete ? (
          <>
            <p className="text-[15px] leading-relaxed text-ash">
              «&nbsp;{toDelete.name}&nbsp;» ({toDelete.sku}) sera supprimé définitivement, avec ses
              photos. Cette action est irréversible.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(toDelete.id)}
                className={buttonClass("dangerSolid", "h-12")}
              >
                {remove.isPending ? "Suppression…" : "Supprimer"}
              </button>
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className={buttonClass("outline", "h-12")}
              >
                Annuler
              </button>
            </div>
          </>
        ) : null}
      </AdminDialog>
    </>
  );
}

/** Columns: select, product, drop, price, stock, status, actions. */
const ROW_GRID =
  "lg:grid-cols-[2rem_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_8.5rem] lg:gap-x-5";

const iconAction =
  "relative z-10 grid size-10 place-items-center rounded-sm text-ash hover:bg-cream hover:text-ink";

function ProductRow({
  product,
  lowStockThreshold,
  selected,
  onToggle,
  onStock,
  onDuplicate,
  onFlags,
  onDelete,
}: {
  product: AdminProductRow;
  lowStockThreshold: number;
  selected: boolean;
  onToggle: () => void;
  onStock: () => void;
  onDuplicate: () => void;
  onFlags: (change: { isActive?: boolean; featured?: boolean }) => void;
  onDelete: () => void;
}) {
  const menuItem =
    "flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm hover:bg-cream/60";
  return (
    <li
      className={cn(
        ROW_GRID,
        "relative grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 rounded-md border border-line bg-paper p-3.5",
        "lg:min-h-22 lg:rounded-none lg:border-0 lg:border-b lg:px-5 lg:py-3 lg:last:border-b-0",
        selected && "ring-1 ring-ink lg:bg-cream/60 lg:ring-0",
        "hover:bg-cream/40",
      )}
    >
      <label className="relative z-10 col-start-1 row-start-1 flex lg:col-start-1">
        <span className="sr-only">Sélectionner {product.name}</span>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="size-4.5 accent-ink"
        />
      </label>

      {/* Product (its link covers the row) */}
      <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-3.5 lg:col-start-2">
        <span className="relative size-16 shrink-0 overflow-hidden rounded-sm bg-cream">
          {product.images[0] && (
            <Image src={product.images[0]} alt="" fill sizes="64px" className="object-contain" />
          )}
        </span>
        <div className="min-w-0">
          <Link
            href={adminRoutes.product(product.id)}
            className="block truncate font-display text-[1.25rem] leading-tight font-medium after:absolute after:inset-0 after:content-['']"
          >
            {product.name}
          </Link>
          <p className="mt-0.5 text-[13px] text-stone">{product.sku}</p>
          {product.featured && <p className="mt-0.5 text-xs text-ash">Mis en avant</p>}
        </div>
      </div>

      <div className="col-start-3 row-start-1 justify-self-end lg:col-start-6 lg:justify-self-start">
        <ProductStatusBadge status={product.status} />
      </div>

      {/* Drop, price, stock: one line on a phone */}
      <p className="col-start-2 row-start-2 text-sm text-ash lg:col-start-3 lg:row-start-1 lg:text-[15px] lg:text-ink">
        {product.drop}
      </p>
      <p className="col-start-3 row-start-2 justify-self-end text-[15px] font-semibold tabular-nums lg:col-start-4 lg:row-start-1 lg:justify-self-start lg:font-normal">
        {formatPrice(product.price)}
      </p>
      <div className="col-start-2 row-start-3 lg:col-start-5 lg:row-start-1">
        <span className="mr-2 text-xs text-stone lg:hidden">Stock</span>
        <StockLevel units={product.stockTotal} level={getStockLevel(product, lowStockThreshold)} />
      </div>

      {/* Actions */}
      <div className="col-start-3 row-start-3 flex items-center justify-end gap-0.5 lg:col-start-7 lg:row-start-1">
        <Link
          href={adminRoutes.product(product.id)}
          aria-label={`Modifier ${product.name}`}
          className={iconAction}
        >
          <EditIcon width={18} height={18} />
        </Link>
        <button
          type="button"
          onClick={onDuplicate}
          aria-label={`Dupliquer ${product.name}`}
          className={iconAction}
        >
          <CopyIcon width={18} height={18} />
        </button>
        <div className="relative z-10">
          <AdminMenu
            label={`Plus d'actions pour ${product.name}`}
            placement="anchored"
            triggerClassName={iconAction}
            trigger={<MoreIcon width={18} height={18} />}
          >
            {(close) => (
              <ul className="py-1">
                <li>
                  <button
                    type="button"
                    className={menuItem}
                    onClick={() => {
                      close();
                      onStock();
                    }}
                  >
                    <BoxIcon width={18} height={18} /> Modifier le stock
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={product.isActive}
                    className={menuItem}
                    onClick={() => {
                      close();
                      onFlags({ isActive: !product.isActive });
                    }}
                  >
                    <CheckIcon
                      width={18}
                      height={18}
                      className={product.isActive ? "" : "opacity-0"}
                    />
                    Visible sur le site
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={product.featured}
                    className={menuItem}
                    onClick={() => {
                      close();
                      onFlags({ featured: !product.featured });
                    }}
                  >
                    <CheckIcon
                      width={18}
                      height={18}
                      className={product.featured ? "" : "opacity-0"}
                    />
                    Mis en avant
                  </button>
                </li>
                {product.isActive && (
                  <li>
                    <button
                      type="button"
                      className={menuItem}
                      onClick={() => {
                        close();
                        onFlags({ isActive: false });
                      }}
                    >
                      <span className="w-4.5" /> Masquer
                    </button>
                  </li>
                )}
                <li className="border-t border-line">
                  <button
                    type="button"
                    className={cn(menuItem, "text-error")}
                    onClick={() => {
                      close();
                      onDelete();
                    }}
                  >
                    <TrashIcon width={18} height={18} /> Supprimer
                  </button>
                </li>
              </ul>
            )}
          </AdminMenu>
        </div>
      </div>
    </li>
  );
}
