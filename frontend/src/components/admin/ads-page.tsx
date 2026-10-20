"use client";

import {
  adSpendInputSchema,
  daysBetween,
  formatPrice,
  type AdSpend,
  type AdSpendInput,
} from "@rassm/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { EditIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { createAdSpend, deleteAdSpend, fetchAdsPage, updateAdSpend } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import {
  AdminEmpty,
  AdminPageHeader,
  adminField,
  adminInput,
  adminLabel,
  buttonClass,
} from "./admin-ui";
import {
  MetricTile,
  RangePicker,
  formatAmount,
  formatDay,
  formatNumber,
  formatRatio,
  useStatsRange,
} from "./stats-ui";
import { useToast } from "./toasts";

// Publicité: ads spend entries (a day or a period) and the figures of the chosen period.
// A period's spend is spread evenly over its days, so a range only counts its own days.

/** "3 commandes livrées": every word of the phrase takes the plural. */
const plural = (count: number, phrase: string) =>
  `${formatNumber(count)} ${count > 1 ? phrase.replace(/(\p{L}+)/gu, "$1s") : phrase}`;

export function AdsPage() {
  const { range, today, setPreset, setCustom } = useStatsRange("30d");
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<AdSpend | "new" | null>(null);
  const [toDelete, setToDelete] = useState<AdSpend | null>(null);
  const query = useQuery({
    queryKey: ["admin", "ads", range.from, range.to],
    queryFn: () => fetchAdsPage({ from: range.from, to: range.to }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "ads"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
  };

  const remove = useMutation({
    mutationFn: deleteAdSpend,
    onSuccess: () => {
      refresh();
      setToDelete(null);
      showToast({ title: "Dépense supprimée", tone: "success" });
    },
    onError: (error) =>
      showToast({
        title: "Suppression impossible",
        message: error instanceof ApiError ? error.message : undefined,
        tone: "error",
      }),
  });

  const summary = data?.summary;
  return (
    <>
      <AdminPageHeader
        title="Publicité"
        count={data ? plural(data.entries.length, "dépense") : undefined}
        subtitle="Vos dépenses Meta Ads et leur rentabilité"
        actions={
          <>
            <RangePicker
              key={`${range.from}-${range.to}`}
              range={range}
              today={today}
              onPreset={setPreset}
              onCustom={setCustom}
            />
            <button
              type="button"
              onClick={() => setEditing("new")}
              className={buttonClass("primary", "h-12", "plain")}
            >
              <PlusIcon width={18} height={18} /> Ajouter une dépense
            </button>
          </>
        }
      />

      <div
        className={cn(
          "mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
          query.isPlaceholderData && "opacity-60",
        )}
      >
        <MetricTile
          label="Dépenses"
          value={summary ? formatPrice(summary.spend) : "·"}
          detail={`du ${formatDay(range.from)} au ${formatDay(range.to)}`}
          info={
            <p>
              Somme des dépenses de la période. Une dépense sur plusieurs jours est répartie à parts
              égales sur chacun de ses jours.
            </p>
          }
        />
        <MetricTile
          label="Coût par commande"
          value={summary ? formatAmount(summary.costPerOrder) : "·"}
          detail={summary ? plural(summary.orders, "commande") : undefined}
          info={<p>Dépenses ÷ commandes passées sur la période.</p>}
        />
        <MetricTile
          label="Coût par commande livrée"
          value={summary ? formatAmount(summary.costPerDeliveredOrder) : "·"}
          detail={summary ? plural(summary.deliveredOrders, "commande livrée") : undefined}
          info={<p>Dépenses ÷ commandes de la période qui sont livrées.</p>}
        />
        <MetricTile
          label="ROAS"
          value={summary ? formatRatio(summary.roas) : "·"}
          detail={summary ? `encaissé : ${formatPrice(summary.revenue)}` : undefined}
          info={
            <p>
              Chiffre d&apos;affaires encaissé (articles des commandes livrées) ÷ dépenses. Un ROAS
              de 3 = 3 DA encaissés pour 1 DA de publicité.
            </p>
          }
        />
      </div>

      <h2 className={cn(adminLabel, "mt-8 mb-3 text-ash")}>Toutes les dépenses</h2>
      {query.isPending ? (
        <AdminEmpty>Chargement…</AdminEmpty>
      ) : query.isError || !data ? (
        <AdminEmpty tone="error">Impossible de charger les dépenses.</AdminEmpty>
      ) : data.entries.length === 0 ? (
        <AdminEmpty>
          Aucune dépense pour le moment. Ajoutez vos dépenses Meta Ads (par jour ou par période)
          pour suivre le coût par commande et le ROAS.
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
            <span>Période</span>
            <span>Montant</span>
            <span>Par jour</span>
            <span>Note</span>
            <span />
          </div>
          <ul className="space-y-2.5 lg:space-y-0">
            {data.entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onEdit={() => setEditing(entry)}
                onDelete={() => setToDelete(entry)}
              />
            ))}
          </ul>
        </div>
      )}

      <AdminDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Ajouter une dépense" : "Modifier la dépense"}
      >
        {editing !== null && (
          <EntryForm
            entry={editing === "new" ? null : editing}
            today={today}
            onDone={(message) => {
              refresh();
              setEditing(null);
              showToast({ title: message, tone: "success" });
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </AdminDialog>

      <AdminDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer cette dépense ?"
      >
        {toDelete && (
          <>
            <p className="text-[15px] leading-relaxed text-ash">
              {formatPrice(toDelete.amount)} ({periodLabel(toDelete)}) sera retirée des
              statistiques.
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
        )}
      </AdminDialog>
    </>
  );
}

const ROW_GRID =
  "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_6rem] lg:gap-x-5";

const periodLabel = (entry: Pick<AdSpend, "startDate" | "endDate">) =>
  entry.startDate === entry.endDate
    ? formatDay(entry.startDate)
    : `du ${formatDay(entry.startDate)} au ${formatDay(entry.endDate)}`;

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: AdSpend;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const days = daysBetween(entry.startDate, entry.endDate);
  const icon = "grid size-10 place-items-center rounded-sm text-ash hover:bg-cream hover:text-ink";
  return (
    <li
      className={cn(
        ROW_GRID,
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-md border border-line bg-paper p-3.5",
        "lg:min-h-16 lg:rounded-none lg:border-0 lg:border-b lg:px-5 lg:py-3 lg:last:border-b-0",
      )}
    >
      <div className="min-w-0">
        <p className="text-[15px]">{periodLabel(entry)}</p>
        <p className="text-xs text-stone">{plural(days, "jour")}</p>
      </div>
      <p className="text-right text-[15px] font-semibold tabular-nums lg:text-left lg:font-normal">
        {formatPrice(entry.amount)}
      </p>
      <p className="text-sm text-ash tabular-nums">
        <span className="lg:hidden">Par jour : </span>
        {formatPrice(Math.round(entry.amount / days))}
      </p>
      <p className="col-span-2 truncate text-sm text-ash lg:col-span-1">{entry.note || "—"}</p>
      <div className="col-span-2 flex justify-end gap-0.5 lg:col-span-1">
        <button type="button" onClick={onEdit} aria-label="Modifier la dépense" className={icon}>
          <EditIcon width={18} height={18} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Supprimer la dépense"
          className={cn(icon, "hover:text-error")}
        >
          <TrashIcon width={18} height={18} />
        </button>
      </div>
    </li>
  );
}

function EntryForm({
  entry,
  today,
  onDone,
  onCancel,
}: {
  entry: AdSpend | null;
  today: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [period, setPeriod] = useState(entry ? entry.startDate !== entry.endDate : false);
  const [startDate, setStartDate] = useState(entry?.startDate ?? today);
  const [endDate, setEndDate] = useState(entry?.endDate ?? today);
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (input: AdSpendInput) =>
      entry ? updateAdSpend(entry.id, input) : createAdSpend(input),
    onSuccess: () => onDone(entry ? "Dépense modifiée" : "Dépense ajoutée"),
    onError: (error) =>
      setErrors(
        error instanceof ApiError
          ? Object.keys(error.fields).length > 0
            ? error.fields
            : { form: error.message }
          : { form: "Enregistrement impossible." },
      ),
  });

  const submit = () => {
    const parsed = adSpendInputSchema.safeParse({
      startDate,
      endDate: period ? endDate : startDate,
      amount: amount.trim() === "" ? undefined : Number(amount.replace(/\s/g, "")),
      note,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  };

  const error = (field: string) =>
    errors[field] ? (
      <p id={`${id}-${field}-error`} className="mt-1 text-sm text-error">
        {errors[field]}
      </p>
    ) : null;
  const described = (field: string) =>
    errors[field]
      ? { "aria-invalid": true as const, "aria-describedby": `${id}-${field}-error` }
      : {};

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <div role="radiogroup" aria-label="Durée" className="grid grid-cols-2 gap-2">
        {[
          { value: false, label: "Un jour" },
          { value: true, label: "Une période" },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={period === option.value}
            onClick={() => setPeriod(option.value)}
            className={buttonClass(
              period === option.value ? "primary" : "outline",
              "h-11",
              "plain",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className={cn("grid gap-3", period && "grid-cols-2")}>
        <label className="block">
          <span className={adminLabel}>{period ? "Du" : "Date"}</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={cn(adminInput, "mt-1.5")}
            {...described("startDate")}
          />
          {error("startDate")}
        </label>
        {period && (
          <label className="block">
            <span className={adminLabel}>Au</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={cn(adminInput, "mt-1.5")}
              {...described("endDate")}
            />
            {error("endDate")}
          </label>
        )}
      </div>
      <label className="block">
        <span className={adminLabel}>Montant (DA)</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className={cn(adminInput, "mt-1.5 tabular-nums")}
          {...described("amount")}
        />
        {error("amount")}
        {period && Number(amount) > 0 && startDate <= endDate && (
          <p className="mt-1 text-xs text-stone">
            Soit {formatPrice(Math.round(Number(amount) / daysBetween(startDate, endDate)))} par
            jour sur {plural(daysBetween(startDate, endDate), "jour")}.
          </p>
        )}
      </label>
      <label className="block">
        <span className={adminLabel}>Note (facultatif)</span>
        <textarea
          rows={2}
          value={note}
          maxLength={200}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Campagne Drop 001"
          className={cn(adminField, "mt-1.5 bg-paper py-2.5")}
          {...described("note")}
        />
        {error("note")}
      </label>
      {errors.form && (
        <p role="alert" className="text-sm text-error">
          {errors.form}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="submit" disabled={save.isPending} className={buttonClass("primary", "h-12")}>
          {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass("outline", "h-12")}>
          Annuler
        </button>
      </div>
    </form>
  );
}
