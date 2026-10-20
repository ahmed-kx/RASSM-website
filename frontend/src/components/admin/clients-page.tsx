"use client";

import {
  CLIENT_BADGES,
  CLIENT_BADGE_LABELS,
  CLIENT_SORTS,
  CLIENT_SORT_LABELS,
  LOYAL_DELIVERED_ORDERS,
  WILAYAS,
  formatPrice,
  formatWilaya,
  type AdminClient,
  type ClientBadge,
  type ClientSort,
} from "@rassm/shared";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRightIcon, DownloadIcon, SearchIcon } from "@/components/ui/icons";
import { formatPhone, formatTableDate, wilayaName } from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { exportClients, fetchClients } from "@/lib/data/admin";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminSelect,
  InitialAvatar,
  Pagination,
  adminInput,
  adminLabel,
  buttonClass,
} from "./admin-ui";
import { Pill } from "./badges";
import { InfoTip, formatNumber } from "./stats-ui";
import { useToast } from "./toasts";

// Clients: the orders grouped by phone number, with badges (Liste noire, Fidèle, À risque).

const DEFAULT_PAGE_SIZE = 20;

const BADGE_TONE: Record<ClientBadge, "alert" | "success" | "warning"> = {
  blacklist: "alert",
  loyal: "success",
  risk: "warning",
};

export function ClientBadges({ badges }: { badges: readonly ClientBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <Pill key={badge} tone={BADGE_TONE[badge]} size="sm">
          {CLIENT_BADGE_LABELS[badge]}
        </Pill>
      ))}
    </span>
  );
}

interface Filters {
  q: string;
  wilaya: string;
  badge: ClientBadge | "all";
  sort: ClientSort;
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
    q: params.get("q") ?? "",
    wilaya: params.get("wilaya") ?? "",
    badge: pick([...CLIENT_BADGES, "all"] as const, params.get("badge"), "all"),
    sort: pick(CLIENT_SORTS, params.get("tri"), "recent"),
    page: positive(params.get("page"), 1),
    pageSize: positive(params.get("par"), DEFAULT_PAGE_SIZE),
  };
}

export function ClientsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);
  const { showToast } = useToast();

  const setFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, page: 1, ...patch };
    const query = new URLSearchParams();
    if (next.q) query.set("q", next.q);
    if (next.wilaya) query.set("wilaya", next.wilaya);
    if (next.badge !== "all") query.set("badge", next.badge);
    if (next.sort !== "recent") query.set("tri", next.sort);
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

  const apiQuery = {
    q: filters.q || undefined,
    wilaya: filters.wilaya || undefined,
    badge: filters.badge,
    sort: filters.sort,
    page: filters.page,
    limit: filters.pageSize,
  };
  const query = useQuery({
    queryKey: ["admin", "clients", apiQuery],
    queryFn: () => fetchClients(apiQuery),
    placeholderData: keepPreviousData,
  });
  const exportMutation = useMutation({
    mutationFn: () => exportClients(apiQuery),
    onError: (error) =>
      showToast({
        title: "Export impossible",
        message: error instanceof ApiError ? error.message : undefined,
        tone: "error",
      }),
  });
  const clients = query.data?.clients ?? [];
  const total = query.data?.total ?? 0;
  const hasFilters = Boolean(filters.q || filters.wilaya || filters.badge !== "all");

  return (
    <>
      <AdminPageHeader
        title="Clients"
        count={query.data ? `${formatNumber(total)} client${total > 1 ? "s" : ""}` : undefined}
        subtitle="Vos clients, regroupés par numéro de téléphone"
        actions={
          <button
            type="button"
            disabled={exportMutation.isPending || total === 0}
            onClick={() => exportMutation.mutate()}
            className={buttonClass("outline", "h-12", "plain")}
          >
            <DownloadIcon width={18} height={18} />
            {exportMutation.isPending ? "Export…" : "Exporter (CSV)"}
          </button>
        }
      />

      <div className="mt-7 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <label className="relative col-span-2 sm:min-w-64 sm:flex-1">
          <span className="sr-only">Rechercher un client</span>
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
            placeholder="Nom ou téléphone…"
            className={cn(adminInput, "pl-10 text-sm")}
          />
        </label>
        <AdminSelect
          label="Wilaya"
          value={filters.wilaya}
          onChange={(value) => setFilters({ wilaya: value })}
          className="sm:w-52"
          options={[
            { value: "", label: "Wilaya : toutes" },
            ...WILAYAS.map((wilaya) => ({
              value: String(wilaya.code),
              label: formatWilaya(wilaya),
            })),
          ]}
        />
        <AdminSelect
          label="Badge"
          value={filters.badge}
          onChange={(value) => setFilters({ badge: value as Filters["badge"] })}
          className="sm:w-44"
          options={[
            { value: "all", label: "Badge : tous" },
            ...CLIENT_BADGES.map((badge) => ({ value: badge, label: CLIENT_BADGE_LABELS[badge] })),
          ]}
        />
        <AdminSelect
          label="Trier par"
          value={filters.sort}
          onChange={(value) => setFilters({ sort: value as ClientSort })}
          className="col-span-2 sm:w-56"
          options={CLIENT_SORTS.map((sort) => ({
            value: sort,
            label: `Trier : ${CLIENT_SORT_LABELS[sort].toLocaleLowerCase("fr")}`,
          }))}
        />
      </div>

      <div className="mt-4">
        {query.isPending ? (
          <AdminEmpty>Chargement des clients…</AdminEmpty>
        ) : query.isError ? (
          <AdminEmpty tone="error">
            {query.error instanceof ApiError
              ? query.error.message
              : "Impossible de charger les clients."}
          </AdminEmpty>
        ) : clients.length === 0 ? (
          <AdminEmpty>
            {hasFilters
              ? "Aucun client ne correspond à ces filtres."
              : "Aucun client pour le moment : ils apparaissent avec leur première commande."}
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
              <span>Client</span>
              <span>Wilaya</span>
              <span>Commandes</span>
              <span className="flex items-center gap-1.5">
                Total dépensé
                <InfoTip label="Total dépensé">
                  <p>Totaux payés (articles + livraison) des commandes livrées de ce client.</p>
                </InfoTip>
              </span>
              <span>Dernière commande</span>
              <span />
            </div>
            <ul className={cn("space-y-2.5 lg:space-y-0", query.isPlaceholderData && "opacity-60")}>
              {clients.map((client) => (
                <ClientRow key={client.phone} client={client} />
              ))}
            </ul>
          </div>
        )}
        {total > 0 && (
          <Pagination
            page={filters.page}
            pageSize={filters.pageSize}
            total={total}
            unit="clients"
            onPage={(page) => setFilters({ page })}
            onPageSize={(pageSize) => setFilters({ pageSize })}
          />
        )}
      </div>
      <p className="mt-6 text-xs text-stone">
        Badges : Fidèle à partir de {LOYAL_DELIVERED_ORDERS} commandes livrées, À risque dès un
        retour, Liste noire quand le numéro y figure.
      </p>
    </>
  );
}

const ROW_GRID =
  "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)_1.25rem] lg:gap-x-5";

function ClientRow({ client }: { client: AdminClient }) {
  const last = formatTableDate(client.lastOrderAt);
  return (
    <li
      className={cn(
        ROW_GRID,
        "relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-md border bg-paper p-3.5 hover:bg-cream/50",
        "lg:min-h-[4.4rem] lg:rounded-none lg:border-0 lg:border-b lg:border-line lg:px-5 lg:py-3 lg:last:border-b-0",
        client.badges.includes("blacklist") ? "border-error/50" : "border-line",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <InitialAvatar name={client.name} />
        <div className="min-w-0">
          <Link
            href={adminRoutes.client(client.phone)}
            className="block truncate text-[15px] font-semibold after:absolute after:inset-0 after:content-['']"
          >
            {client.name}
          </Link>
          <p className="truncate text-[13px] text-ash tabular-nums">{formatPhone(client.phone)}</p>
          <div className="mt-1 empty:hidden">
            <ClientBadges badges={client.badges} />
          </div>
        </div>
      </div>
      <p className="justify-self-end text-sm text-ash lg:justify-self-start">
        {wilayaName(client.wilayaCode)}
      </p>
      <p className="text-sm tabular-nums">
        {formatNumber(client.orders)} commande{client.orders > 1 ? "s" : ""}
        <span className="block text-xs text-stone">
          {formatNumber(client.delivered)} livrée{client.delivered > 1 ? "s" : ""}
          {client.returned > 0 &&
            ` · ${formatNumber(client.returned)} retournée${client.returned > 1 ? "s" : ""}`}
        </span>
      </p>
      <p className="justify-self-end text-[15px] font-semibold tabular-nums lg:justify-self-start lg:font-normal">
        {formatPrice(client.spent)}
      </p>
      <time
        dateTime={client.lastOrderAt}
        className="col-span-2 text-xs text-stone tabular-nums lg:col-span-1 lg:text-[13px] lg:text-ash"
      >
        <span className="lg:hidden">Dernière commande : </span>
        {last.day}
      </time>
      <ChevronRightIcon width={18} height={18} className="hidden text-ash lg:block" />
    </li>
  );
}
