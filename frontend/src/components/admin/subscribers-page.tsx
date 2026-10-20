"use client";

import {
  SUBSCRIBER_SYNC_LABELS,
  SUBSCRIBER_SYNC_STATUSES,
  type AdminSubscriber,
  type SubscriberSyncStatus,
} from "@rassm/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DownloadIcon, ExternalIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/admin/format";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  deleteSubscriber,
  exportSubscribers,
  fetchSubscribers,
  retrySubscriberSync,
} from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminSelect,
  Pagination,
  adminInput,
  adminLabel,
  buttonClass,
} from "./admin-ui";
import { Pill } from "./badges";
import { formatNumber } from "./stats-ui";
import { useToast } from "./toasts";

// Abonnés: newsletter sign-ups, kept in sync with the Brevo list (newsletters are written and
// sent from Brevo).

const DEFAULT_PAGE_SIZE = 20;
const BREVO_URL = "https://app.brevo.com/";

const SYNC_TONE: Record<SubscriberSyncStatus, "success" | "danger" | "sand" | "warning"> = {
  synced: "success",
  failed: "danger",
  pending: "warning",
  off: "sand",
};

interface Filters {
  q: string;
  sync: SubscriberSyncStatus | "all";
  page: number;
  pageSize: number;
}

function readFilters(params: URLSearchParams): Filters {
  const positive = (value: string | null, fallback: number) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  };
  return {
    q: params.get("q") ?? "",
    sync:
      [...SUBSCRIBER_SYNC_STATUSES, "all" as const].find(
        (value) => value === params.get("brevo"),
      ) ?? "all",
    page: positive(params.get("page"), 1),
    pageSize: positive(params.get("par"), DEFAULT_PAGE_SIZE),
  };
}

export function SubscribersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);
  const [toDelete, setToDelete] = useState<AdminSubscriber | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const setFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, page: 1, ...patch };
    const query = new URLSearchParams();
    if (next.q) query.set("q", next.q);
    if (next.sync !== "all") query.set("brevo", next.sync);
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
    sync: filters.sync,
    page: filters.page,
    limit: filters.pageSize,
  };
  const query = useQuery({
    queryKey: ["admin", "subscribers", apiQuery],
    queryFn: () => fetchSubscribers(apiQuery),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "subscribers"] });
  const fail = (title: string) => (error: unknown) =>
    showToast({
      title,
      message: error instanceof ApiError ? error.message : undefined,
      tone: "error",
    });

  const exportMutation = useMutation({
    mutationFn: () => exportSubscribers(apiQuery),
    onError: fail("Export impossible"),
  });
  const retry = useMutation({
    mutationFn: retrySubscriberSync,
    onSuccess: (subscriber) => {
      void refresh();
      showToast(
        subscriber.sync.status === "synced"
          ? { title: "Ajouté à la liste Brevo", message: subscriber.email, tone: "success" }
          : {
              title: "Toujours en erreur",
              message: subscriber.sync.error ?? undefined,
              tone: "error",
            },
      );
    },
    onError: fail("Synchronisation impossible"),
  });
  const remove = useMutation({
    mutationFn: deleteSubscriber,
    onSuccess: () => {
      void refresh();
      setToDelete(null);
      showToast({ title: "Abonné supprimé", tone: "success" });
    },
    onError: fail("Suppression impossible"),
  });

  const subscribers = query.data?.subscribers ?? [];
  const total = query.data?.total ?? 0;

  return (
    <>
      <AdminPageHeader
        title="Abonnés"
        count={query.data ? `${formatNumber(total)} abonné${total > 1 ? "s" : ""}` : undefined}
        subtitle="Les inscrits à la newsletter"
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

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-paper px-4 py-3 text-sm text-ash">
        <p className="flex-1">
          Les newsletters s&apos;écrivent et s&apos;envoient depuis Brevo. Chaque inscription est
          ajoutée automatiquement à votre liste Brevo ; supprimer un abonné ici le retire de la
          liste.
          {query.data && !query.data.brevoConfigured && (
            <span className="mt-1 block text-warning">
              Synchronisation désactivée : ajoutez BREVO_NEWSLETTER_LIST_ID dans backend/.env, puis
              lancez « pnpm sync-newsletter ».
            </span>
          )}
        </p>
        <a
          href={BREVO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4"
        >
          Ouvrir Brevo <ExternalIcon width={16} height={16} />
        </a>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
        <label className="relative col-span-2 sm:min-w-64 sm:flex-1">
          <span className="sr-only">Rechercher un e-mail</span>
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
            placeholder="Rechercher un e-mail…"
            className={cn(adminInput, "pl-10 text-sm")}
          />
        </label>
        <AdminSelect
          label="Synchronisation Brevo"
          value={filters.sync}
          onChange={(value) => setFilters({ sync: value as Filters["sync"] })}
          className="col-span-2 sm:w-56"
          options={[
            { value: "all", label: "Brevo : tous" },
            ...SUBSCRIBER_SYNC_STATUSES.map((status) => ({
              value: status,
              label: SUBSCRIBER_SYNC_LABELS[status],
            })),
          ]}
        />
      </div>

      <div className="mt-4">
        {query.isPending ? (
          <AdminEmpty>Chargement des abonnés…</AdminEmpty>
        ) : query.isError ? (
          <AdminEmpty tone="error">Impossible de charger les abonnés.</AdminEmpty>
        ) : subscribers.length === 0 ? (
          <AdminEmpty>
            {filters.q || filters.sync !== "all"
              ? "Aucun abonné ne correspond à ces filtres."
              : "Aucun abonné pour le moment."}
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
              <span>E-mail</span>
              <span>Inscription</span>
              <span>Brevo</span>
              <span />
            </div>
            <ul className={cn("space-y-2.5 lg:space-y-0", query.isPlaceholderData && "opacity-60")}>
              {subscribers.map((subscriber) => (
                <li
                  key={subscriber.id}
                  className={cn(
                    ROW_GRID,
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-md border border-line bg-paper p-3.5",
                    "lg:min-h-16 lg:rounded-none lg:border-0 lg:border-b lg:px-5 lg:py-3 lg:last:border-b-0",
                  )}
                >
                  <p className="truncate text-[15px]">{subscriber.email}</p>
                  <time
                    dateTime={subscriber.createdAt}
                    className="justify-self-end text-xs text-stone tabular-nums lg:justify-self-start lg:text-sm lg:text-ash"
                  >
                    {formatDateTime(subscriber.createdAt)}
                  </time>
                  <div className="min-w-0">
                    <Pill tone={SYNC_TONE[subscriber.sync.status]}>
                      {SUBSCRIBER_SYNC_LABELS[subscriber.sync.status]}
                    </Pill>
                    {subscriber.sync.status === "failed" && subscriber.sync.error && (
                      <p className="mt-1 text-xs text-error">{subscriber.sync.error}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {(subscriber.sync.status === "failed" ||
                      subscriber.sync.status === "pending") && (
                      <button
                        type="button"
                        disabled={retry.isPending}
                        onClick={() => retry.mutate(subscriber.id)}
                        className={buttonClass("soft", "h-10", "plain")}
                      >
                        Réessayer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setToDelete(subscriber)}
                      aria-label={`Supprimer ${subscriber.email}`}
                      className="grid size-10 place-items-center rounded-sm text-ash hover:bg-cream hover:text-error"
                    >
                      <TrashIcon width={18} height={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {total > 0 && (
          <Pagination
            page={filters.page}
            pageSize={filters.pageSize}
            total={total}
            unit="abonnés"
            onPage={(page) => setFilters({ page })}
            onPageSize={(pageSize) => setFilters({ pageSize })}
          />
        )}
      </div>

      <AdminDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer cet abonné ?"
      >
        <p className="text-[15px] leading-relaxed text-ash">
          {toDelete?.email} ne recevra plus la newsletter : il est supprimé du site et retiré de la
          liste Brevo.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => toDelete && remove.mutate(toDelete.id)}
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
      </AdminDialog>
    </>
  );
}

const ROW_GRID = "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_9rem] lg:gap-x-5";
