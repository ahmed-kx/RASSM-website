"use client";

import { parseAdminSettingsInput } from "@rassm/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { saveAdminSettings } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { adminInput, buttonClass } from "./admin-ui";
import { useToast } from "./toasts";

/**
 * "Seuil de stock faible": a product is "Stock faible" when its total stock is at or below
 * this number (stored in the database, shared by every admin).
 */
export function LowStockDialog({
  open,
  current,
  onClose,
}: {
  open: boolean;
  current: number;
  onClose: () => void;
}) {
  return (
    <AdminDialog open={open} onClose={onClose} title="Seuil de stock faible">
      {/* Mounted only while open, so the field starts from the saved value each time. */}
      {open && <LowStockForm current={current} onClose={onClose} />}
    </AdminDialog>
  );
}

function LowStockForm({ current, onClose }: { current: number; onClose: () => void }) {
  const id = useId();
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const save = useMutation({
    mutationFn: saveAdminSettings,
    onSuccess: (settings) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      showToast({
        title: "Seuil enregistré",
        message: `Stock faible : ${settings.lowStockThreshold} unités ou moins.`,
        tone: "success",
      });
      onClose();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : "Enregistrement impossible."),
  });

  const submit = () => {
    const parsed = parseAdminSettingsInput({ lowStockThreshold: value });
    if (!parsed.success) {
      setError(parsed.errors.lowStockThreshold ?? "Valeur invalide.");
      return;
    }
    setError(null);
    save.mutate(parsed.data);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="text-[15px] leading-relaxed text-ash">
        Un produit passe en «&nbsp;Stock faible&nbsp;» quand son stock total (toutes couleurs et
        tailles) est inférieur ou égal à ce nombre. À 0 unité, il est en «&nbsp;Rupture&nbsp;».
      </p>
      <label htmlFor={id} className="mt-5 block text-sm font-semibold">
        Unités au total
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(adminInput, "mt-2 max-w-40 tabular-nums")}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-error">
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button type="submit" disabled={save.isPending} className={buttonClass("primary", "h-12")}>
          {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={onClose} className={buttonClass("outline", "h-12")}>
          Annuler
        </button>
      </div>
    </form>
  );
}
