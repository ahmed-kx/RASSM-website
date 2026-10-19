"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BanIcon } from "@/components/ui/icons";
import { formatDateTime, formatPhone } from "@/lib/admin/format";
import { ApiError } from "@/lib/api";
import { addToBlacklist, fetchBlacklist, removeFromBlacklist } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { AdminEmpty, AdminPageHeader, adminInput, adminLabel, buttonClass } from "./admin-ui";
import { useToast } from "./toasts";

/** Blacklisted phone numbers: their new orders are saved but flagged "Liste noire". */
export function BlacklistPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [toRemove, setToRemove] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["admin", "blacklist"], queryFn: fetchBlacklist });

  const refresh = (entries: Awaited<ReturnType<typeof fetchBlacklist>>) => {
    queryClient.setQueryData(["admin", "blacklist"], entries);
    void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "order"] });
  };
  const fail = (title: string) => (error: unknown) =>
    showToast({
      title,
      message: error instanceof ApiError ? error.message : undefined,
      tone: "error",
    });

  const add = useMutation({
    mutationFn: () => addToBlacklist(phone, reason),
    onSuccess: (entries) => {
      refresh(entries);
      setPhone("");
      setReason("");
      showToast({ title: "Numéro ajouté à la liste noire" });
    },
    onError: fail("Ajout impossible"),
  });

  const remove = useMutation({
    mutationFn: removeFromBlacklist,
    onSuccess: (entries) => {
      refresh(entries);
      setToRemove(null);
      showToast({ title: "Numéro retiré de la liste noire" });
    },
    onError: fail("Suppression impossible"),
  });

  return (
    <>
      <AdminPageHeader
        title="Liste noire"
        count={
          query.data ? `${query.data.length} numéro${query.data.length > 1 ? "s" : ""}` : undefined
        }
        subtitle="Numéros signalés dans les commandes"
      />
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-ash">
        Les commandes de ces numéros sont toujours enregistrées, mais signalées «&nbsp;Liste
        noire&nbsp;» en rouge dans les commandes et dans l&apos;e-mail.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
        className="mt-6 grid gap-3 rounded-md border border-line bg-paper p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end sm:p-5"
      >
        <label className="block">
          <span className={adminLabel}>Téléphone</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="0555 12 34 56"
            className={`${adminInput} mt-1.5`}
          />
        </label>
        <label className="block">
          <span className={adminLabel}>Raison</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Colis refusé"
            maxLength={200}
            className={`${adminInput} mt-1.5`}
          />
        </label>
        <button
          type="submit"
          disabled={add.isPending || !phone.trim() || reason.trim().length < 3}
          className={buttonClass("primary")}
        >
          Ajouter
        </button>
      </form>

      <div className="mt-5">
        {query.isPending ? (
          <AdminEmpty>Chargement…</AdminEmpty>
        ) : query.isError ? (
          <AdminEmpty tone="error">Impossible de charger la liste noire.</AdminEmpty>
        ) : query.data.length === 0 ? (
          <AdminEmpty>Aucun numéro sur la liste noire.</AdminEmpty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
            {query.data.map((entry) => (
              <li key={entry.phone} className="flex items-center gap-3 p-4 sm:px-5">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-error/10 text-error"
                >
                  <BanIcon width={18} height={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">{formatPhone(entry.phone)}</p>
                  <p className="text-sm text-error">{entry.reason}</p>
                  <p className="mt-0.5 text-xs text-stone">
                    {entry.orderCount} commande{entry.orderCount > 1 ? "s" : ""} · ajouté le{" "}
                    {formatDateTime(entry.createdAt)}
                    {entry.createdBy ? ` par ${entry.createdBy}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setToRemove(entry.phone)}
                  className={buttonClass("outline", "shrink-0")}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AdminDialog
        open={toRemove !== null}
        onClose={() => setToRemove(null)}
        title="Retirer ce numéro ?"
      >
        <p className="text-[15px] text-ash">
          Les prochaines commandes du {toRemove ? formatPhone(toRemove) : ""} ne seront plus
          signalées.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => toRemove && remove.mutate(toRemove)}
            className={buttonClass("primary", "h-12")}
          >
            Retirer
          </button>
          <button
            type="button"
            onClick={() => setToRemove(null)}
            className={buttonClass("outline", "h-12")}
          >
            Annuler
          </button>
        </div>
      </AdminDialog>
    </>
  );
}
