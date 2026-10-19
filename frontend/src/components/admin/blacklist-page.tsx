"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDateTime, formatPhone } from "@/lib/admin/format";
import { ApiError } from "@/lib/api";
import { addToBlacklist, fetchBlacklist, removeFromBlacklist } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { AdminPageTitle } from "./admin-shell";
import { useToast } from "./toasts";

const input =
  "h-11 w-full border border-ink/25 bg-paper px-3 text-[15px] focus:border-ink focus:outline-none";

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
      <AdminPageTitle title="Liste noire" />
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ash">
        Les commandes de ces numéros sont toujours enregistrées, mais signalées «&nbsp;Liste
        noire&nbsp;» en rouge dans les commandes et dans l&apos;e-mail.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
        className="mt-5 grid gap-3 border border-line bg-paper p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
      >
        <label className="block text-xs text-ash">
          Téléphone
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="0555 12 34 56"
            className={`${input} mt-1`}
          />
        </label>
        <label className="block text-xs text-ash">
          Raison
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Colis refusé"
            maxLength={200}
            className={`${input} mt-1`}
          />
        </label>
        <button
          type="submit"
          disabled={add.isPending || !phone.trim() || reason.trim().length < 3}
          className="h-11 bg-ink px-5 text-[11px] font-semibold tracking-button text-paper uppercase disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>

      <div className="mt-5">
        {query.isPending ? (
          <p className="py-8 text-center text-sm text-stone">Chargement…</p>
        ) : query.isError ? (
          <p role="alert" className="py-8 text-center text-sm text-error">
            Impossible de charger la liste noire.
          </p>
        ) : query.data.length === 0 ? (
          <p className="border border-dashed border-line py-10 text-center text-sm text-stone">
            Aucun numéro sur la liste noire.
          </p>
        ) : (
          <ul className="divide-y divide-line border border-line bg-paper">
            {query.data.map((entry) => (
              <li key={entry.phone} className="flex items-center gap-3 p-4">
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
                  className="h-11 shrink-0 border border-ink px-3 text-[11px] font-semibold tracking-button uppercase"
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
            className="h-12 bg-ink text-[11px] font-semibold tracking-button text-paper uppercase disabled:opacity-60"
          >
            Retirer
          </button>
          <button
            type="button"
            onClick={() => setToRemove(null)}
            className="h-12 border border-ink text-[11px] font-semibold tracking-button uppercase"
          >
            Annuler
          </button>
        </div>
      </AdminDialog>
    </>
  );
}
