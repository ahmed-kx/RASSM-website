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
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  CloseIcon,
  DownloadIcon,
  FilterIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { formatPhone, formatRelativeTime, orderProductLine, wilayaName } from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { exportForAnderson, fetchAdminOrders, shipOrders } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { AdminPageTitle } from "./admin-shell";
import { OrderFlags, StatusBadge } from "./badges";
import { useToast } from "./toasts";
import { useSingleFlight } from "./use-single-flight";

interface Filters {
  status: OrderTab;
  q: string;
  wilaya: string;
  from: string;
  to: string;
}

function readFilters(params: URLSearchParams): Filters {
  const status = params.get("statut");
  return {
    status: ORDER_TABS.find((tab) => tab === status) ?? "pending",
    q: params.get("q") ?? "",
    wilaya: params.get("wilaya") ?? "",
    from: params.get("du") ?? "",
    to: params.get("au") ?? "",
  };
}

/** Re-renders every minute so "il y a 5 min" stays right. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const field =
  "h-11 w-full border border-ink/25 bg-paper px-3 text-[15px] text-ink focus:border-ink focus:outline-none";

export function OrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(
    Boolean(filters.wilaya || filters.from || filters.to),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toShip, setToShip] = useState<string[] | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const now = useNow();

  const setFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const query = new URLSearchParams();
    if (next.status !== "pending") query.set("statut", next.status);
    if (next.q) query.set("q", next.q);
    if (next.wilaya) query.set("wilaya", next.wilaya);
    if (next.from) query.set("du", next.from);
    if (next.to) query.set("au", next.to);
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

  const query = useInfiniteQuery({
    queryKey: ["admin", "orders", filters],
    queryFn: ({ pageParam }) =>
      fetchAdminOrders({
        status: filters.status,
        q: filters.q || undefined,
        wilaya: filters.wilaya || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const orders = useMemo(
    () => query.data?.pages.flatMap((page) => page.orders) ?? [],
    [query.data],
  );
  const counts = query.data?.pages[0]?.counts;
  const exportMode = filters.status === "confirmed";

  const once = useSingleFlight();
  const exportMutation = useMutation({
    mutationFn: exportForAnderson,
    onSuccess: (ids) => {
      showToast({
        title: "Fichier Anderson téléchargé",
        message: `${ids.length} commande${ids.length > 1 ? "s" : ""}`,
      });
      setToShip(ids);
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
        title: `${result.shipped} commande${result.shipped > 1 ? "s" : ""} marquée${result.shipped > 1 ? "s" : ""} expédiée${result.shipped > 1 ? "s" : ""}`,
        message: result.skipped
          ? `${result.skipped} ignorée(s) : elles n'étaient plus confirmées.`
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

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const hasFilters = Boolean(filters.q || filters.wilaya || filters.from || filters.to);

  return (
    <>
      <AdminPageTitle title="Commandes" />

      {/* Tabs by status, with counts (scroll sideways on a phone). */}
      <div className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
                  "flex h-10 items-center gap-2 border px-3.5 text-[13px] whitespace-nowrap transition-colors",
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper text-ash hover:border-ink",
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
          <span className="sr-only">Rechercher par nom ou téléphone</span>
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone"
            width={18}
            height={18}
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom ou téléphone"
            className={cn(field, "pl-10")}
          />
        </label>
        <button
          type="button"
          onClick={() => setShowFilters((open) => !open)}
          aria-expanded={showFilters}
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 border px-3 text-[13px]",
            showFilters || filters.wilaya || filters.from || filters.to
              ? "border-ink bg-ink text-paper"
              : "border-ink/25 bg-paper",
          )}
        >
          <FilterIcon width={18} height={18} />
          <span className="hidden sm:inline">Filtres</span>
        </button>
      </div>
      {showFilters && (
        <div className="mt-2 grid gap-3 border border-line bg-paper p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <label className="block text-xs text-ash">
            Wilaya
            <span className="relative mt-1 block">
              <select
                value={filters.wilaya}
                onChange={(event) => setFilters({ wilaya: event.target.value })}
                className={cn(field, "appearance-none pr-9")}
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
            <label className="block text-xs text-ash">
              Du
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(event) => setFilters({ from: event.target.value })}
                className={cn(field, "mt-1")}
              />
            </label>
            <label className="block text-xs text-ash">
              Au
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(event) => setFilters({ to: event.target.value })}
                className={cn(field, "mt-1")}
              />
            </label>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilters({ q: "", wilaya: "", from: "", to: "" });
              }}
              className="flex h-11 items-center justify-center gap-1.5 px-2 text-[13px] text-ash underline underline-offset-4"
            >
              <CloseIcon width={14} height={14} /> Effacer
            </button>
          )}
        </div>
      )}

      {/* Anderson export (confirmed orders) */}
      {exportMode && orders.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border border-line bg-paper p-3">
          <p className="mr-auto text-sm text-ash">
            {selected.size > 0
              ? `${selected.size} commande${selected.size > 1 ? "s" : ""} sélectionnée${selected.size > 1 ? "s" : ""}`
              : "Cochez les commandes à envoyer à Anderson, ou exportez tout."}
          </p>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="h-11 px-3 text-[13px] text-ash underline underline-offset-4"
            >
              Désélectionner
            </button>
          )}
          <button
            type="button"
            disabled={exportMutation.isPending}
            onClick={() =>
              once(() =>
                exportMutation.mutateAsync(
                  selected.size > 0 ? { ids: [...selected] } : { all: true },
                ),
              )
            }
            className="flex h-11 items-center gap-2 bg-ink px-4 text-[11px] font-semibold tracking-button text-paper uppercase disabled:opacity-60"
          >
            <DownloadIcon width={18} height={18} />
            {selected.size > 0 ? `Exporter (${selected.size})` : "Tout exporter"}
          </button>
        </div>
      )}

      {/* List */}
      <div className="mt-4">
        {query.isPending ? (
          <p className="py-10 text-center text-sm text-stone">Chargement des commandes…</p>
        ) : query.isError ? (
          <p role="alert" className="py-10 text-center text-sm text-error">
            {query.error instanceof ApiError
              ? query.error.message
              : "Impossible de charger les commandes."}
          </p>
        ) : orders.length === 0 ? (
          <p className="border border-dashed border-line py-12 text-center text-sm text-stone">
            {hasFilters
              ? "Aucune commande ne correspond à ces filtres."
              : "Aucune commande ici pour le moment."}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                now={now}
                showStatus={filters.status === "all"}
                selectable={exportMode}
                selected={selected.has(order.id)}
                onToggle={() => toggle(order.id)}
              />
            ))}
          </ul>
        )}
        {query.hasNextPage && (
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="mt-4 h-12 w-full border border-ink text-[11px] font-semibold tracking-button uppercase disabled:opacity-60"
          >
            {query.isFetchingNextPage ? "Chargement…" : "Voir plus de commandes"}
          </button>
        )}
      </div>

      <AdminDialog
        open={toShip !== null}
        onClose={() => setToShip(null)}
        title="Marquer expédiées ?"
      >
        <p className="text-[15px] leading-relaxed text-ash">
          Le fichier pour Anderson est téléchargé. Voulez-vous marquer{" "}
          {toShip?.length === 1 ? "cette commande" : `ces ${toShip?.length ?? 0} commandes`} comme
          expédiée{(toShip?.length ?? 0) > 1 ? "s" : ""} ?
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={shipMutation.isPending}
            onClick={() => toShip && once(() => shipMutation.mutateAsync(toShip))}
            className="h-12 bg-ink text-[11px] font-semibold tracking-button text-paper uppercase disabled:opacity-60"
          >
            {shipMutation.isPending ? "En cours…" : "Oui, marquer expédiées"}
          </button>
          <button
            type="button"
            onClick={() => setToShip(null)}
            className="h-12 border border-ink text-[11px] font-semibold tracking-button uppercase"
          >
            Plus tard
          </button>
        </div>
      </AdminDialog>
    </>
  );
}

function OrderCard({
  order,
  now,
  showStatus,
  selectable,
  selected,
  onToggle,
}: {
  order: AdminOrder;
  now: number;
  showStatus: boolean;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={cn(
        "flex border bg-paper transition-colors",
        order.blacklist ? "border-error/60" : "border-line",
        selected && "border-ink ring-1 ring-ink",
      )}
    >
      {selectable && (
        <label className="flex w-12 shrink-0 cursor-pointer items-center justify-center border-r border-line">
          <span className="sr-only">Sélectionner la commande de {order.fullName}</span>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="size-5 accent-ink"
          />
        </label>
      )}
      <Link
        href={adminRoutes.order(order.id)}
        className="grid min-w-0 flex-1 gap-1 p-3.5 hover:bg-cream/40 sm:p-4 lg:grid-cols-[1.3fr_1.6fr_auto] lg:items-center lg:gap-6"
      >
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3 lg:block">
            <p className="truncate text-[15px] font-semibold">{order.fullName}</p>
            <p className="shrink-0 text-[15px] font-semibold tabular-nums lg:hidden">
              {formatPrice(order.total)}
            </p>
          </div>
          <p className="text-sm text-ash tabular-nums">
            {formatPhone(order.phone)} · {wilayaName(order.wilayaCode)}
          </p>
        </div>
        <p className="truncate text-sm text-ash">{orderProductLine(order)}</p>
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end lg:gap-1">
          <span className="flex flex-wrap items-center gap-1.5">
            {showStatus && <StatusBadge status={order.status} />}
            <OrderFlags order={order} />
          </span>
          <span className="flex items-center gap-3">
            <time dateTime={order.createdAt} className="text-xs whitespace-nowrap text-stone">
              {formatRelativeTime(order.createdAt, now)}
            </time>
            <span className="hidden text-[15px] font-semibold tabular-nums lg:inline">
              {formatPrice(order.total)}
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
}
