"use client";

import {
  REGIONS,
  REGION_LABELS,
  WILAYAS,
  deliveryFeeUpdateSchema,
  formatDeliveryWindow,
  formatPrice,
  type AdminDeliveryFees,
  type DeliveryBulk,
  type DeliveryFee,
  type Region,
  type TierWarning,
} from "@rassm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CoinsIcon,
  DownloadIcon,
  EditIcon,
  HomeIcon,
  MapPinIcon,
  MoreIcon,
  OrdersIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { adminRoutes } from "@/lib/admin/routes";
import { matchesSearch } from "@/lib/search-text";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  bulkUpdateDeliveryFees,
  fetchAdminDeliveryFees,
  updateDeliveryFee,
} from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { AdminMenu } from "./admin-top-bar";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminSelect,
  KpiCard,
  Pagination,
  Switch,
  adminInput,
  adminLabel,
  buttonClass,
} from "./admin-ui";
import { Pill } from "./badges";
import { useToast } from "./toasts";

const DEFAULT_PAGE_SIZE = 20;
const SORTS = {
  code: "Code",
  name: "Nom (A → Z)",
  price: "Prix à domicile",
  days: "Délai",
} as const;
type Sort = keyof typeof SORTS;
type Tab = Region | "all";

interface Row extends DeliveryFee {
  name: string;
  region: Region;
}

interface Filters {
  region: Tab;
  q: string;
  stopDesk: "all" | "yes" | "no";
  status: "all" | "active" | "suspended";
  sort: Sort;
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
    region: pick(["all", ...REGIONS] as const, params.get("region"), "all"),
    q: params.get("q") ?? "",
    stopDesk: pick(["all", "yes", "no"] as const, params.get("bureau"), "all"),
    status: pick(["all", "active", "suspended"] as const, params.get("statut"), "all"),
    sort: pick(Object.keys(SORTS) as Sort[], params.get("tri"), "code"),
    page: positive(params.get("page"), 1),
    pageSize: positive(params.get("par"), DEFAULT_PAGE_SIZE),
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;
const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
const code = (value: number) => String(value).padStart(2, "0");

/** Excel-friendly CSV of the price table (UTF-8 BOM, ";"). */
function downloadCsv(rows: readonly Row[]) {
  const lines = [
    ["Code", "Wilaya", "Région", "À domicile (DA)", "Au bureau (DA)", "Délai (jours)", "Statut"],
    ...rows.map((row) => [
      code(row.wilayaCode),
      row.name,
      REGION_LABELS[row.region],
      row.homePrice,
      row.stopDeskPrice ?? "Non disponible",
      row.estimatedDays,
      row.suspended ? "Suspendu" : "Actif",
    ]),
  ].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"));
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `livraison-anderson-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function TierWarnings({ warnings }: { warnings: readonly TierWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-warning/40 bg-warning/8 px-4 py-3 text-sm text-warning"
    >
      <p className="font-semibold">Réductions de livraison à corriger</p>
      <ul className="mt-1 space-y-1">
        {warnings.map((warning) => (
          <li key={`${warning.productId}-${warning.amount}`}>
            <Link
              href={adminRoutes.product(warning.productId)}
              className="underline underline-offset-4"
            >
              {warning.productName}
            </Link>{" "}
            : réduction de {formatPrice(warning.amount)}, qui doit rester inférieure au tarif à
            domicile le plus élevé ({formatPrice(warning.maxHomePrice)}).
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DeliveryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Row | null>(null);
  const [bulk, setBulk] = useState<"adjust" | "suspend" | "reactivate" | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const setFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, page: 1, ...patch };
    const query = new URLSearchParams();
    if (next.region !== "all") query.set("region", next.region);
    if (next.q) query.set("q", next.q);
    if (next.stopDesk !== "all") query.set("bureau", next.stopDesk);
    if (next.status !== "all") query.set("statut", next.status);
    if (next.sort !== "code") query.set("tri", next.sort);
    if (next.page > 1) query.set("page", String(next.page));
    if (next.pageSize !== DEFAULT_PAGE_SIZE) query.set("par", String(next.pageSize));
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (search.trim() === filters.q) return;
    const timer = setTimeout(() => setFilters({ q: search.trim() }), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text changes
  }, [search]);

  const query = useQuery({ queryKey: ["admin", "delivery-fees"], queryFn: fetchAdminDeliveryFees });
  const rows = useMemo<Row[]>(
    () =>
      WILAYAS.flatMap((wilaya) => {
        const fee = query.data?.deliveryFees.find((item) => item.wilayaCode === wilaya.code);
        return fee ? [{ ...fee, name: wilaya.name, region: wilaya.region }] : [];
      }),
    [query.data],
  );

  const matches = (row: Row) =>
    (!filters.q || matchesSearch(`${row.name} ${code(row.wilayaCode)}`, filters.q)) &&
    (filters.stopDesk === "all" || (filters.stopDesk === "yes") === (row.stopDeskPrice !== null)) &&
    (filters.status === "all" || (filters.status === "suspended") === row.suspended);
  const filtered = rows.filter(matches);
  const counts = Object.fromEntries(
    (["all", ...REGIONS] as const).map((tab) => [
      tab,
      tab === "all" ? filtered.length : filtered.filter((row) => row.region === tab).length,
    ]),
  ) as Record<Tab, number>;
  const sorters: Record<Sort, (a: Row, b: Row) => number> = {
    code: (a, b) => a.wilayaCode - b.wilayaCode,
    name: (a, b) => a.name.localeCompare(b.name, "fr"),
    price: (a, b) => a.homePrice - b.homePrice || a.wilayaCode - b.wilayaCode,
    days: (a, b) => a.estimatedDays - b.estimatedDays || a.wilayaCode - b.wilayaCode,
  };
  const inTab = filtered
    .filter((row) => filters.region === "all" || row.region === filters.region)
    .sort(sorters[filters.sort]);
  const pageRows = inTab.slice(
    (filters.page - 1) * filters.pageSize,
    filters.page * filters.pageSize,
  );

  const active = rows.filter((row) => !row.suspended);
  const stopDeskPrices = active.flatMap((row) =>
    row.stopDeskPrice === null ? [] : [row.stopDeskPrice],
  );

  const apply = (data: AdminDeliveryFees) => {
    queryClient.setQueryData(["admin", "delivery-fees"], data);
  };

  const toggle = (wilaya: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(wilaya)) next.delete(wilaya);
      else next.add(wilaya);
      return next;
    });
  const allOnPage = pageRows.length > 0 && pageRows.every((row) => selected.has(row.wilayaCode));
  const togglePage = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const row of pageRows) {
        if (allOnPage) next.delete(row.wilayaCode);
        else next.add(row.wilayaCode);
      }
      return next;
    });

  const quick = useMutation({
    mutationFn: (row: Row) =>
      bulkUpdateDeliveryFees({
        action: row.suspended ? "reactivate" : "suspend",
        codes: [row.wilayaCode],
      }),
    onSuccess: (data, row) => {
      apply(data);
      showToast({
        title: `${row.name} : livraison ${row.suspended ? "réactivée" : "suspendue"}`,
        tone: "success",
      });
    },
    onError: (error) =>
      showToast({
        title: "Modification impossible",
        message: error instanceof ApiError ? error.message : undefined,
        tone: "error",
      }),
  });

  return (
    <>
      <AdminPageHeader
        title="Livraison"
        count={rows.length ? plural(rows.length, "wilaya") : undefined}
        subtitle="Tarifs Anderson, départ Alger"
        actions={
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() => downloadCsv(inTab)}
            className={buttonClass("soft", "h-12", "plain")}
          >
            <DownloadIcon width={18} height={18} /> Exporter
          </button>
        }
      />

      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={OrdersIcon}
          label="Wilayas actives"
          value={query.data ? String(active.length) : "·"}
        />
        <KpiCard
          icon={CoinsIcon}
          label="Prix moyen à domicile"
          value={query.data ? formatPrice(average(active.map((row) => row.homePrice))) : "·"}
        />
        <KpiCard
          icon={HomeIcon}
          label="Prix moyen au bureau"
          value={query.data ? formatPrice(average(stopDeskPrices)) : "·"}
        />
        <KpiCard
          icon={MapPinIcon}
          label="Stop desk disponibles"
          value={query.data ? String(rows.filter((row) => row.stopDeskPrice !== null).length) : "·"}
        />
      </div>

      {query.data && query.data.warnings.length > 0 && (
        <div className="mt-4">
          <TierWarnings warnings={query.data.warnings} />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 2xl:flex-row 2xl:items-center">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 2xl:pb-0">
          <div
            role="tablist"
            aria-label="Régions"
            className="flex w-max overflow-hidden rounded-sm border border-line bg-paper"
          >
            {(["all", ...REGIONS] as const).map((tab) => {
              const current = tab === filters.region;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={current}
                  onClick={() => setFilters({ region: tab })}
                  className={cn(
                    "flex h-11 items-center gap-2.5 border-r border-line px-4 text-sm whitespace-nowrap last:border-r-0",
                    current ? "bg-ink text-paper" : "text-ink hover:bg-cream/60",
                  )}
                >
                  {tab === "all" ? "Toutes" : REGION_LABELS[tab]}
                  <span
                    className={cn("text-xs tabular-nums", current ? "text-mist" : "text-stone")}
                  >
                    {query.data ? counts[tab] : "·"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:flex-wrap 2xl:justify-end">
          <label className="relative col-span-2 sm:min-w-56 sm:flex-1 2xl:max-w-64">
            <span className="sr-only">Rechercher une wilaya</span>
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
              placeholder="Rechercher une wilaya…"
              className={cn(adminInput, "pl-10 text-sm")}
            />
          </label>
          <AdminSelect
            label="Stop desk"
            value={filters.stopDesk}
            onChange={(value) => setFilters({ stopDesk: value as Filters["stopDesk"] })}
            options={[
              { value: "all", label: "Stop desk : tous" },
              { value: "yes", label: "Stop desk disponible" },
              { value: "no", label: "Sans stop desk" },
            ]}
          />
          <AdminSelect
            label="Statut"
            value={filters.status}
            onChange={(value) => setFilters({ status: value as Filters["status"] })}
            options={[
              { value: "all", label: "Statut : tous" },
              { value: "active", label: "Actif" },
              { value: "suspended", label: "Suspendu" },
            ]}
          />
          <AdminSelect
            label="Trier par"
            value={filters.sort}
            onChange={(value) => setFilters({ sort: value as Sort })}
            className="col-span-2 sm:col-span-1"
            options={(Object.keys(SORTS) as Sort[]).map((sort) => ({
              value: sort,
              label: `Trier : ${SORTS[sort].toLowerCase()}`,
            }))}
          />
        </div>
      </div>

      <div className="mt-4">
        {query.isPending ? (
          <AdminEmpty>Chargement des tarifs…</AdminEmpty>
        ) : query.isError ? (
          <AdminEmpty tone="error">
            {query.error instanceof ApiError
              ? query.error.message
              : "Impossible de charger les tarifs."}
          </AdminEmpty>
        ) : pageRows.length === 0 ? (
          <AdminEmpty>Aucune wilaya ne correspond à ces filtres.</AdminEmpty>
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
              <span>Wilaya</span>
              <span>Code</span>
              <span>À domicile</span>
              <span>Au bureau</span>
              <span>Délai</span>
              <span>Statut</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="space-y-2.5 lg:space-y-0">
              {pageRows.map((row) => (
                <li
                  key={row.wilayaCode}
                  className={cn(
                    ROW_GRID,
                    "grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-md border border-line bg-paper p-3.5",
                    "lg:min-h-16 lg:rounded-none lg:border-0 lg:border-b lg:px-5 lg:py-2.5 lg:last:border-b-0",
                    selected.has(row.wilayaCode) && "ring-1 ring-ink lg:bg-cream/60 lg:ring-0",
                    row.suspended && "bg-sand/30",
                  )}
                >
                  <label className="col-start-1 row-start-1 flex">
                    <span className="sr-only">Sélectionner {row.name}</span>
                    <input
                      type="checkbox"
                      checked={selected.has(row.wilayaCode)}
                      onChange={() => toggle(row.wilayaCode)}
                      className="size-4.5 accent-ink"
                    />
                  </label>
                  <p className="col-start-2 row-start-1 truncate font-display text-[1.3rem] leading-tight font-medium lg:col-start-2">
                    <span className="mr-2 font-serif text-sm text-stone tabular-nums lg:hidden">
                      {code(row.wilayaCode)}
                    </span>
                    {row.name}
                  </p>
                  <p className="hidden text-[15px] tabular-nums lg:col-start-3 lg:row-start-1 lg:block">
                    {code(row.wilayaCode)}
                  </p>
                  <p className="col-start-2 row-start-2 text-sm tabular-nums lg:col-start-4 lg:row-start-1 lg:text-[15px]">
                    <span className="mr-1.5 text-stone lg:hidden">Domicile</span>
                    {formatPrice(row.homePrice)}
                  </p>
                  <p
                    className={cn(
                      "col-start-2 row-start-3 text-sm tabular-nums lg:col-start-5 lg:row-start-1 lg:text-[15px]",
                      row.stopDeskPrice === null && "text-stone italic",
                    )}
                  >
                    <span className="mr-1.5 text-stone not-italic lg:hidden">Bureau</span>
                    {row.stopDeskPrice === null ? "Non disponible" : formatPrice(row.stopDeskPrice)}
                  </p>
                  <p className="col-start-3 row-start-2 justify-self-end text-sm text-ash lg:col-start-6 lg:row-start-1 lg:justify-self-start lg:text-[15px] lg:text-ink">
                    {formatDeliveryWindow(row.estimatedDays)}
                  </p>
                  <div className="col-start-3 row-start-1 justify-self-end lg:col-start-7 lg:justify-self-start">
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2.5 rounded-full",
                          row.suspended ? "bg-warning" : "bg-success",
                        )}
                      />
                      <Pill tone={row.suspended ? "warning" : "success"}>
                        {row.suspended ? "Suspendu" : "Actif"}
                      </Pill>
                    </span>
                  </div>
                  <div className="col-start-3 row-start-3 flex items-center justify-end gap-0.5 lg:col-start-8 lg:row-start-1">
                    <button
                      type="button"
                      aria-label={`Modifier ${row.name}`}
                      onClick={() => setEditing(row)}
                      className="grid size-10 place-items-center rounded-sm text-ash hover:bg-cream hover:text-ink"
                    >
                      <EditIcon width={18} height={18} />
                    </button>
                    <AdminMenu
                      label={`Plus d'actions pour ${row.name}`}
                      placement="anchored"
                      triggerClassName="grid size-10 place-items-center rounded-sm text-ash hover:bg-cream hover:text-ink"
                      trigger={<MoreIcon width={18} height={18} />}
                    >
                      {(close) => (
                        <button
                          type="button"
                          disabled={quick.isPending}
                          onClick={() => {
                            close();
                            quick.mutate(row);
                          }}
                          className={cn(
                            "flex min-h-12 w-full items-center px-4 text-left text-sm hover:bg-cream/60",
                            !row.suspended && "text-error",
                          )}
                        >
                          {row.suspended ? "Réactiver la livraison" : "Suspendre la livraison"}
                        </button>
                      )}
                    </AdminMenu>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {inTab.length > 0 && (
          <Pagination
            page={filters.page}
            pageSize={filters.pageSize}
            total={inTab.length}
            unit="wilayas"
            onPage={(page) => setFilters({ page })}
            onPageSize={(pageSize) => setFilters({ pageSize })}
          />
        )}
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-4 flex flex-wrap items-center gap-2 rounded-md bg-onyx p-3 text-paper shadow-[0_18px_40px_-18px_rgb(17_17_17/0.6)] lg:bottom-5">
          <p className="mr-auto pl-1 text-sm">
            {plural(selected.size, "wilaya")} sélectionnée{selected.size > 1 ? "s" : ""}
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
            onClick={() => setBulk("suspend")}
            className={buttonClass("onDarkOutline")}
          >
            Suspendre
          </button>
          <button
            type="button"
            onClick={() => setBulk("reactivate")}
            className={buttonClass("onDarkOutline")}
          >
            Réactiver
          </button>
          <button
            type="button"
            onClick={() => setBulk("adjust")}
            className={buttonClass("onDarkPrimary")}
          >
            Modifier les prix
          </button>
        </div>
      )}

      {editing && (
        <EditFeeDialog
          row={editing}
          currentWarnings={query.data?.warnings ?? []}
          onClose={() => setEditing(null)}
          onSaved={(data) => {
            apply(data);
            showToast({ title: `${editing.name} : tarifs enregistrés`, tone: "success" });
            setEditing(null);
          }}
        />
      )}
      {bulk && (
        <BulkDialog
          action={bulk}
          rows={rows.filter((row) => selected.has(row.wilayaCode))}
          currentWarnings={query.data?.warnings ?? []}
          onClose={() => setBulk(null)}
          onDone={(data, message) => {
            apply(data);
            setSelected(new Set());
            setBulk(null);
            showToast({ title: message, tone: "success" });
          }}
        />
      )}
    </>
  );
}

/** Columns: select, wilaya, code, home, office, delay, status, actions. */
const ROW_GRID =
  "lg:grid-cols-[2rem_minmax(0,1.6fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem] lg:gap-x-5";

/** Warnings that a change would add (the ones already there are shown on the page). */
const newWarnings = (next: readonly TierWarning[], current: readonly TierWarning[]) =>
  next.filter(
    (warning) =>
      !current.some(
        (known) => known.productId === warning.productId && known.amount === warning.amount,
      ),
  );

function EditFeeDialog({
  row,
  currentWarnings,
  onClose,
  onSaved,
}: {
  row: Row;
  currentWarnings: readonly TierWarning[];
  onClose: () => void;
  onSaved: (data: AdminDeliveryFees) => void;
}) {
  const [homePrice, setHomePrice] = useState(row.homePrice);
  const [hasStopDesk, setHasStopDesk] = useState(row.stopDeskPrice !== null);
  const [stopDeskPrice, setStopDeskPrice] = useState(
    row.stopDeskPrice ?? Math.round(row.homePrice * 0.6),
  );
  const [days, setDays] = useState(row.estimatedDays);
  const [suspended, setSuspended] = useState(row.suspended);
  const [pendingWarnings, setPendingWarnings] = useState<TierWarning[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = {
    homePrice,
    stopDeskPrice: hasStopDesk ? stopDeskPrice : null,
    estimatedDays: days,
    suspended,
  };
  const parsed = deliveryFeeUpdateSchema.safeParse(update);
  const fieldErrors = parsed.success
    ? {}
    : Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      );

  const save = useMutation({
    mutationFn: async (confirmed: boolean) => {
      if (!confirmed) {
        const preview = await updateDeliveryFee(row.wilayaCode, update, true);
        const added = newWarnings(preview.warnings, currentWarnings);
        if (added.length > 0) return { warnings: added };
      }
      return { saved: await updateDeliveryFee(row.wilayaCode, update) };
    },
    onSuccess: (result) => {
      if ("warnings" in result && result.warnings) setPendingWarnings(result.warnings);
      else if ("saved" in result && result.saved) onSaved(result.saved);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : "Enregistrement impossible."),
  });

  const numberInput = (
    id: string,
    label: string,
    value: number,
    onChange: (value: number) => void,
    suffix: string,
  ) => (
    <div>
      <label htmlFor={id} className={adminLabel}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          value={Number.isFinite(value) ? value : ""}
          onChange={(event) => {
            setPendingWarnings(null);
            onChange(event.target.valueAsNumber);
          }}
          aria-invalid={fieldErrors[id.replace("fee-", "")] ? true : undefined}
          className={cn(adminInput, "pr-14 tabular-nums")}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-stone">
          {suffix}
        </span>
      </div>
      {fieldErrors[id.replace("fee-", "")] && (
        <p className="mt-1 text-sm text-error">{fieldErrors[id.replace("fee-", "")]}</p>
      )}
    </div>
  );

  return (
    <AdminDialog open onClose={onClose} title={`${code(row.wilayaCode)} - ${row.name}`}>
      <div className="grid gap-4">
        {numberInput("fee-homePrice", "À domicile", homePrice, setHomePrice, "DA")}
        <div className="rounded-md border border-line p-3">
          <Switch
            label="Stop desk (au bureau)"
            description={
              hasStopDesk
                ? "Les clients peuvent choisir le retrait au bureau."
                : "Livraison à domicile uniquement."
            }
            checked={hasStopDesk}
            onChange={(value) => {
              setPendingWarnings(null);
              setHasStopDesk(value);
            }}
          />
          {hasStopDesk && (
            <div className="mt-2">
              {numberInput("fee-stopDeskPrice", "Au bureau", stopDeskPrice, setStopDeskPrice, "DA")}
            </div>
          )}
        </div>
        {numberInput("fee-estimatedDays", "Délai", days, setDays, "jours")}
        <p className="-mt-2 text-xs text-stone">
          Affiché : {Number.isFinite(days) ? formatDeliveryWindow(days) : "—"}
        </p>
        <div className="rounded-md border border-line p-3">
          <Switch
            label="Livraison suspendue"
            description="Les clients ne peuvent plus choisir cette wilaya et le site refuse ses commandes."
            checked={suspended}
            onChange={(value) => {
              setPendingWarnings(null);
              setSuspended(value);
            }}
          />
        </div>
        {pendingWarnings && <TierWarnings warnings={pendingWarnings} />}
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={!parsed.success || save.isPending}
            onClick={() => {
              setError(null);
              save.mutate(pendingWarnings !== null);
            }}
            className={buttonClass(pendingWarnings ? "dangerSolid" : "primary", "h-12")}
          >
            {save.isPending
              ? "Enregistrement…"
              : pendingWarnings
                ? "Enregistrer quand même"
                : "Enregistrer"}
          </button>
          <button type="button" onClick={onClose} className={buttonClass("outline", "h-12")}>
            Annuler
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}

function BulkDialog({
  action,
  rows,
  currentWarnings,
  onClose,
  onDone,
}: {
  action: DeliveryBulk["action"];
  rows: readonly Row[];
  currentWarnings: readonly TierWarning[];
  onClose: () => void;
  onDone: (data: AdminDeliveryFees, message: string) => void;
}) {
  const [amount, setAmount] = useState(100);
  const [preview, setPreview] = useState<AdminDeliveryFees | null>(null);
  const [error, setError] = useState<string | null>(null);
  const codes = rows.map((row) => row.wilayaCode);
  const bulk: DeliveryBulk = action === "adjust" ? { action, codes, amount } : { action, codes };

  // Price change: preview as the amount changes.
  useEffect(() => {
    if (action !== "adjust") return;
    setPreview(null);
    setError(null);
    if (!Number.isInteger(amount) || amount === 0) return;
    const timer = setTimeout(() => {
      bulkUpdateDeliveryFees({ action, codes, amount }, true)
        .then(setPreview)
        .catch((caught: unknown) =>
          setError(caught instanceof ApiError ? caught.message : "Aperçu impossible."),
        );
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the selection is fixed while open
  }, [amount, action]);

  const save = useMutation({
    mutationFn: () => bulkUpdateDeliveryFees(bulk),
    onSuccess: (data) =>
      onDone(
        data,
        action === "adjust"
          ? `${plural(rows.length, "wilaya")} : prix ${amount > 0 ? "+" : "−"}${formatPrice(Math.abs(amount))}`
          : `${plural(rows.length, "wilaya")} ${action === "suspend" ? "suspendue" : "réactivée"}${rows.length > 1 ? "s" : ""}`,
      ),
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : "Modification impossible."),
  });

  const added = preview ? newWarnings(preview.warnings, currentWarnings) : [];
  const title =
    action === "adjust"
      ? "Modifier les prix"
      : action === "suspend"
        ? "Suspendre la livraison"
        : "Réactiver la livraison";

  return (
    <AdminDialog open onClose={onClose} title={title}>
      <p className="text-sm text-ash">
        {plural(rows.length, "wilaya")} :{" "}
        {rows
          .slice(0, 6)
          .map((row) => row.name)
          .join(", ")}
        {rows.length > 6 ? "…" : ""}
      </p>
      {action === "adjust" ? (
        <div className="mt-4 grid gap-4">
          <div>
            <label htmlFor="bulk-amount" className={adminLabel}>
              Changer chaque prix de (DA)
            </label>
            <input
              id="bulk-amount"
              type="number"
              inputMode="numeric"
              step={50}
              value={Number.isFinite(amount) ? amount : ""}
              onChange={(event) => setAmount(event.target.valueAsNumber)}
              className={cn(adminInput, "mt-1.5 tabular-nums")}
            />
            <p className="mt-1 text-xs text-stone">
              Exemple : 100 pour augmenter, −50 pour baisser. Domicile et bureau changent ensemble.
            </p>
          </div>
          {preview && (
            <div>
              <p className={cn(adminLabel, "mb-2")}>Aperçu</p>
              <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-md border border-line bg-paper text-sm">
                {rows.map((row) => {
                  const next = preview.deliveryFees.find(
                    (fee) => fee.wilayaCode === row.wilayaCode,
                  );
                  return (
                    <li
                      key={row.wilayaCode}
                      className="flex justify-between gap-3 px-3 py-2 tabular-nums"
                    >
                      <span className="truncate">{row.name}</span>
                      <span className="shrink-0 text-ash">
                        {formatPrice(row.homePrice)} →{" "}
                        <strong className="text-ink">
                          {next ? formatPrice(next.homePrice) : "—"}
                        </strong>
                        {row.stopDeskPrice !== null && next?.stopDeskPrice != null && (
                          <> · bureau {formatPrice(next.stopDeskPrice)}</>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {added.length > 0 && <TierWarnings warnings={added} />}
        </div>
      ) : (
        <p className="mt-3 text-[15px] leading-relaxed text-ash">
          {action === "suspend"
            ? "Les clients ne pourront plus choisir ces wilayas et le site refusera leurs commandes, jusqu'à leur réactivation."
            : "Les clients pourront de nouveau commander dans ces wilayas."}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={save.isPending || (action === "adjust" && !preview)}
          onClick={() => save.mutate()}
          className={buttonClass(
            action === "suspend" || added.length > 0 ? "dangerSolid" : "primary",
            "h-12",
          )}
        >
          {save.isPending
            ? "En cours…"
            : action === "adjust"
              ? added.length > 0
                ? "Appliquer quand même"
                : "Appliquer"
              : title}
        </button>
        <button type="button" onClick={onClose} className={buttonClass("outline", "h-12")}>
          Annuler
        </button>
      </div>
    </AdminDialog>
  );
}
