"use client";

import {
  ORDER_TABS,
  ORDER_TAB_LABELS,
  WILAYAS,
  formatPrice,
  formatWilaya,
  type AdminOrder,
  type OrderTab,
} from "@rassm/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  SearchIcon,
  SlidersIcon,
} from "@/components/ui/icons";
import { formatPhone, formatTableDate, wilayaName } from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { cancelOrders, exportForAnderson, fetchAdminOrders, shipOrders } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import {
  AdminEmpty,
  AdminPageHeader,
  InitialAvatar,
  Pagination,
  adminInput,
  adminLabel,
  buttonClass,
} from "./admin-ui";
import { OrderFlags, StatusBadge } from "./badges";
import { useToast } from "./toasts";
import { useSingleFlight } from "./use-single-flight";

const DEFAULT_PAGE_SIZE = 20;

interface Filters {
  status: OrderTab;
  q: string;
  wilaya: string;
  from: string;
  to: string;
  tests: boolean;
  page: number;
  pageSize: number;
}

function readFilters(params: URLSearchParams): Filters {
  const status = params.get("statut");
  const positive = (value: string | null, fallback: number) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  };
  return {
    status: ORDER_TABS.find((tab) => tab === status) ?? "pending",
    q: params.get("q") ?? "",
    wilaya: params.get("wilaya") ?? "",
    from: params.get("du") ?? "",
    to: params.get("au") ?? "",
    tests: params.get("tests") === "1",
    page: positive(params.get("page"), 1),
    pageSize: positive(params.get("par"), DEFAULT_PAGE_SIZE),
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** What to ship: after an export (file downloaded) or straight from the selection. */
interface ShipRequest {
  ids: string[];
  afterExport: boolean;
}

export function OrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);
  const activeFilters = [filters.wilaya, filters.from, filters.to, filters.tests].filter(
    Boolean,
  ).length;
  const [showFilters, setShowFilters] = useState(activeFilters > 0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toShip, setToShip] = useState<ShipRequest | null>(null);
  const [toCancel, setToCancel] = useState<string[] | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const setFilters = (patch: Partial<Filters>) => {
    // Any change other than the page number goes back to page 1.
    const next = { ...filters, page: 1, ...patch };
    const query = new URLSearchParams();
    if (next.status !== "pending") query.set("statut", next.status);
    if (next.q) query.set("q", next.q);
    if (next.wilaya) query.set("wilaya", next.wilaya);
    if (next.from) query.set("du", next.from);
    if (next.to) query.set("au", next.to);
    if (next.tests) query.set("tests", "1");
    if (next.page > 1) query.set("page", String(next.page));
    if (next.pageSize !== DEFAULT_PAGE_SIZE) query.set("par", String(next.pageSize));
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    if (patch.status !== undefined) setSelected(new Set());
  };

  // Search as you type (after a short pause).
  useEffect(() => {
    if (search.trim() === filters.q) return;
    const timer = setTimeout(() => setFilters({ q: search.trim() }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text changes
  }, [search]);

  const query = useQuery({
    queryKey: ["admin", "orders", filters],
    queryFn: () =>
      fetchAdminOrders({
        status: filters.status,
        q: filters.q || undefined,
        wilaya: filters.wilaya || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        tests: filters.tests ? "1" : undefined,
        page: filters.page,
        limit: filters.pageSize,
      }),
    placeholderData: keepPreviousData,
  });

  const orders = query.data?.orders ?? [];
  const counts = query.data?.counts;
  const total = counts?.[filters.status] ?? 0;

  const once = useSingleFlight();
  const exportMutation = useMutation({
    mutationFn: exportForAnderson,
    onSuccess: (ids) => {
      showToast({ title: "Fichier Anderson téléchargé", message: plural(ids.length, "commande") });
      setToShip({ ids, afterExport: true });
    },
    onError: (error) =>
      showToast({
        title: "Export impossible",
        message: error instanceof ApiError ? error.message : undefined,
        tone: "error",
      }),
  });

  const shipMutation = useMutation({
    mutationFn: shipOrders,
    onSuccess: async (result) => {
      setToShip(null);
      setSelected(new Set());
      showToast({
        title: `${plural(result.shipped, "commande")} marquée${result.shipped > 1 ? "s" : ""} expédiée${result.shipped > 1 ? "s" : ""}`,
        message: result.skipped
          ? `${result.skipped} ignorée(s) : elles n'étaient pas confirmées.`
          : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (error) =>
      showToast({
        title: "Action impossible",
        message: error instanceof ApiError ? error.message : undefined,
        tone: "error",
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelOrders,
    onSuccess: async (result) => {
      setToCancel(null);
      setSelected(new Set());
      showToast({
        title: `${plural(result.cancelled, "commande")} annulée${result.cancelled > 1 ? "s" : ""}`,
        message: result.skipped
          ? `${result.skipped} ignorée(s) : seules les commandes nouvelles ou confirmées peuvent être annulées.`
          : "Le stock est remis.",
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (error) =>
      showToast({
        title: "Action impossible",
        message: error instanceof ApiError ? error.message : undefined,
        tone: "error",
      }),
  });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOnPage = orders.length > 0 && orders.every((order) => selected.has(order.id));
  const togglePage = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const order of orders) {
        if (allOnPage) next.delete(order.id);
        else next.add(order.id);
      }
      return next;
    });

  const hasFilters = Boolean(filters.q || activeFilters);
  const clearFilters = () => {
    setSearch("");
    setFilters({ q: "", wilaya: "", from: "", to: "", tests: false });
  };

  return (
    <>
      <AdminPageHeader
        title="Commandes"
        count={counts ? plural(counts.all, "commande") : undefined}
        subtitle="Gérez vos commandes en toute simplicité"
        actions={
          <button
            type="button"
            disabled={exportMutation.isPending}
            onClick={() => once(() => exportMutation.mutateAsync({ all: true }))}
            className={buttonClass("soft", undefined, "plain")}
          >
            <DownloadIcon width={18} height={18} />
            Exporter pour Anderson
          </button>
        }
      />

      {/* Status tabs with counts (scroll sideways on a phone). */}
      <div className="-mx-4 mt-7 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Statut des commandes" className="flex w-max gap-2">
          {ORDER_TABS.map((tab) => {
            const active = tab === filters.status;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilters({ status: tab })}
                className={cn(
                  "flex h-10 items-center gap-2.5 rounded-sm border px-4 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper text-ink hover:border-ink",
                )}
              >
                {ORDER_TAB_LABELS[tab]}
                <span className={cn("text-xs tabular-nums", active ? "text-mist" : "text-stone")}>
                  {counts?.[tab] ?? "·"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and filters */}
      <div className="mt-4 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Rechercher par nom, téléphone ou numéro de commande</span>
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone"
            width={18}
            height={18}
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom du client, téléphone ou numéro de commande…"
            className={cn(adminInput, "pl-11")}
          />
        </label>
        <button
          type="button"
          onClick={() => setShowFilters((open) => !open)}
          aria-expanded={showFilters}
          aria-controls="order-filters"
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 rounded-sm border px-4 text-sm transition-colors",
            showFilters ? "border-ink bg-paper" : "border-line bg-paper hover:border-ink",
          )}
        >
          <SlidersIcon width={18} height={18} />
          <span className="hidden sm:inline">Filtres</span>
          {activeFilters > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] text-paper">
              {activeFilters}
            </span>
          )}
        </button>
      </div>
      {showFilters && (
        <div
          id="order-filters"
          className="mt-2 grid gap-3 rounded-md border border-line bg-paper p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
        >
          <label className="block">
            <span className={adminLabel}>Wilaya</span>
            <span className="relative mt-1.5 block">
              <select
                value={filters.wilaya}
                onChange={(event) => setFilters({ wilaya: event.target.value })}
                className={cn(adminInput, "appearance-none pr-9")}
              >
                <option value="">Toutes les wilayas</option>
                {WILAYAS.map((wilaya) => (
                  <option key={wilaya.code} value={wilaya.code}>
                    {formatWilaya(wilaya)}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:contents">
            <label className="block">
              <span className={adminLabel}>Du</span>
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(event) => setFilters({ from: event.target.value })}
                className={cn(adminInput, "mt-1.5")}
              />
            </label>
            <label className="block">
              <span className={adminLabel}>Au</span>
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(event) => setFilters({ to: event.target.value })}
                className={cn(adminInput, "mt-1.5")}
              />
            </label>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-11 items-center justify-center gap-1.5 px-2 text-sm text-ash underline underline-offset-4"
            >
              <CloseIcon width={14} height={14} /> Effacer
            </button>
          )}
          <label className="flex min-h-11 items-center gap-2.5 text-sm sm:col-span-full">
            <input
              type="checkbox"
              checked={filters.tests}
              onChange={(event) => setFilters({ tests: event.target.checked })}
              className="size-4 accent-ink"
            />
            Commandes de test
          </label>
        </div>
      )}

      {/* Table (cards on a phone) */}
      <div className="mt-4">
        {query.isPending ? (
          <AdminEmpty>Chargement des commandes…</AdminEmpty>
        ) : query.isError ? (
          <AdminEmpty tone="error">
            {query.error instanceof ApiError
              ? query.error.message
              : "Impossible de charger les commandes."}
          </AdminEmpty>
        ) : orders.length === 0 ? (
          <AdminEmpty>
            {hasFilters
              ? "Aucune commande ne correspond à ces filtres."
              : "Aucune commande ici pour le moment."}
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
              <span>Client</span>
              <span>Produit</span>
              <span>Ville</span>
              <span>Statut</span>
              <span>Total</span>
              <span>Date</span>
              <span />
            </div>
            <ul
              className={cn(
                "space-y-2.5 transition-opacity lg:space-y-0",
                query.isPlaceholderData && "opacity-60",
              )}
            >
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  selected={selected.has(order.id)}
                  onToggle={() => toggle(order.id)}
                />
              ))}
            </ul>
          </div>
        )}
        {total > 0 && (
          <Pagination
            page={filters.page}
            pageSize={filters.pageSize}
            total={total}
            unit="commandes"
            onPage={(page) => setFilters({ page })}
            onPageSize={(pageSize) => setFilters({ pageSize })}
          />
        )}
      </div>

      {/* Bulk actions on the selected orders */}
      {selected.size > 0 && (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-4 flex flex-wrap items-center gap-2 rounded-md bg-onyx p-3 text-paper shadow-[0_18px_40px_-18px_rgb(17_17_17/0.6)] lg:bottom-5">
          <p className="mr-auto pl-1 text-sm">
            {plural(selected.size, "commande")} sélectionnée{selected.size > 1 ? "s" : ""}
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
            onClick={() => setToCancel([...selected])}
            className={buttonClass("onDarkOutline")}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => setToShip({ ids: [...selected], afterExport: false })}
            className={buttonClass("onDarkOutline")}
          >
            Marquer expédiées
          </button>
          <button
            type="button"
            disabled={exportMutation.isPending}
            onClick={() => once(() => exportMutation.mutateAsync({ ids: [...selected] }))}
            className={buttonClass("onDarkPrimary")}
          >
            <DownloadIcon width={18} height={18} />
            Exporter ({selected.size})
          </button>
        </div>
      )}

      <AdminDialog
        open={toShip !== null}
        onClose={() => setToShip(null)}
        title="Marquer expédiées ?"
      >
        <p className="text-[15px] leading-relaxed text-ash">
          {toShip?.afterExport ? "Le fichier pour Anderson est téléchargé. " : ""}
          Voulez-vous marquer{" "}
          {toShip?.ids.length === 1
            ? "cette commande"
            : `ces ${toShip?.ids.length ?? 0} commandes`}{" "}
          comme expédiée{(toShip?.ids.length ?? 0) > 1 ? "s" : ""} ?
          {toShip?.afterExport ? "" : " Seules les commandes confirmées seront marquées."}
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={shipMutation.isPending}
            onClick={() => toShip && once(() => shipMutation.mutateAsync(toShip.ids))}
            className={buttonClass("primary", "h-12")}
          >
            {shipMutation.isPending ? "En cours…" : "Oui, marquer expédiées"}
          </button>
          <button
            type="button"
            onClick={() => setToShip(null)}
            className={buttonClass("outline", "h-12")}
          >
            Plus tard
          </button>
        </div>
      </AdminDialog>

      <AdminDialog
        open={toCancel !== null}
        onClose={() => setToCancel(null)}
        title="Annuler les commandes ?"
      >
        <p className="text-[15px] leading-relaxed text-ash">
          Voulez-vous annuler{" "}
          {toCancel?.length === 1 ? "cette commande" : `ces ${toCancel?.length ?? 0} commandes`} ?
          Le stock sera remis. Seules les commandes nouvelles ou confirmées seront annulées.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-warning">
          Une commande « Suspecte » peut venir d&apos;un vrai client : appelez avant de
          l&apos;annuler.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={cancelMutation.isPending}
            onClick={() => toCancel && once(() => cancelMutation.mutateAsync(toCancel))}
            className={buttonClass("dangerSolid", "h-12")}
          >
            {cancelMutation.isPending ? "En cours…" : "Oui, annuler"}
          </button>
          <button
            type="button"
            onClick={() => setToCancel(null)}
            className={buttonClass("outline", "h-12")}
          >
            Non, garder
          </button>
        </div>
      </AdminDialog>
    </>
  );
}

/** Columns of the computer table: select, client, product, city, status, total, date, arrow. */
const ROW_GRID =
  "lg:grid-cols-[2rem_minmax(0,1.45fr)_minmax(0,1.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_1.25rem] lg:gap-x-5";

function OrderRow({
  order,
  selected,
  onToggle,
}: {
  order: AdminOrder;
  selected: boolean;
  onToggle: () => void;
}) {
  const unopened = order.openedAt === null && order.status === "pending";
  const date = formatTableDate(order.createdAt);
  return (
    <li
      className={cn(
        ROW_GRID,
        // Phone: a card. Computer: a table row.
        "relative grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 rounded-md border p-3.5 transition-colors",
        "lg:min-h-[4.6rem] lg:rounded-none lg:border-0 lg:border-b lg:border-line lg:px-5 lg:py-3 lg:last:border-b-0",
        unopened ? "bg-sand/45" : "bg-paper",
        order.blacklist ? "border-error/50" : "border-line",
        order.blacklist && "lg:shadow-[inset_3px_0_0_var(--color-error)]",
        selected && "ring-1 ring-ink lg:bg-cream/60 lg:ring-0",
        "hover:bg-cream/50",
      )}
    >
      <label className="relative z-10 col-start-1 row-start-1 flex lg:col-start-1">
        <span className="sr-only">Sélectionner la commande de {order.fullName}</span>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="size-4.5 accent-ink"
        />
      </label>

      {/* Client (its link covers the whole row) */}
      <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-3 lg:col-start-2">
        <InitialAvatar name={order.fullName} />
        <div className="min-w-0">
          <Link
            href={adminRoutes.order(order.id)}
            className="block truncate text-[15px] font-semibold after:absolute after:inset-0 after:content-['']"
          >
            {order.fullName}
          </Link>
          <p className="truncate text-[13px] text-ash tabular-nums">{formatPhone(order.phone)}</p>
          <div className="mt-1 empty:hidden">
            <OrderFlags order={order} />
          </div>
        </div>
      </div>

      {/* Product */}
      <div className="col-span-2 col-start-2 row-start-2 flex min-w-0 items-center gap-3 lg:col-span-1 lg:col-start-3 lg:row-start-1">
        <span className="relative size-11 shrink-0 overflow-hidden rounded-sm bg-cream">
          <Image src={order.item.image} alt="" fill sizes="44px" className="object-contain" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{order.item.name}</p>
          <p className="truncate text-[13px] text-ash">
            {order.item.color} · {order.item.size} · ×{order.item.quantity}
          </p>
        </div>
      </div>

      {/* City */}
      <p className="col-start-2 row-start-3 truncate text-sm text-ash lg:col-start-4 lg:row-start-1">
        {wilayaName(order.wilayaCode)}
      </p>

      {/* Status */}
      <div className="col-start-3 row-start-1 justify-self-end lg:col-start-5 lg:justify-self-start">
        <StatusBadge status={order.status} />
      </div>

      {/* Total */}
      <p className="col-start-3 row-start-2 justify-self-end text-[15px] font-semibold tabular-nums lg:col-start-6 lg:row-start-1 lg:justify-self-start">
        {formatPrice(order.total)}
      </p>

      {/* Date */}
      <time
        dateTime={order.createdAt}
        className="col-start-3 row-start-3 justify-self-end text-xs text-stone tabular-nums lg:col-start-7 lg:row-start-1 lg:justify-self-start lg:text-[13px] lg:leading-snug lg:text-ash"
      >
        <span>{date.day}</span>
        <span className="lg:block"> {date.time}</span>
      </time>

      <ChevronRightIcon
        width={18}
        height={18}
        className="hidden text-ash lg:col-start-8 lg:row-start-1 lg:block"
      />
    </li>
  );
}
