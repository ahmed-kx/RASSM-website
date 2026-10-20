"use client";

import { parseAdminSettingsInput, type AdminSettings } from "@rassm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fetchAdminSettings, saveAdminSettings } from "@/lib/data/admin";
import { AdminCard, AdminEmpty, AdminPageHeader, adminInput, buttonClass } from "./admin-ui";
import { SecuritySection } from "./security-section";
import { useToast } from "./toasts";

// Paramètres: the costs used by the profit statistics, and the "Stock faible" threshold.

const FIELDS: { key: keyof AdminSettings; label: string; unit: string; help: string }[] = [
  {
    key: "packagingCost",
    label: "Coût d'emballage par commande",
    unit: "DA",
    help: "Sac, étiquette, carte… Compté sur chaque commande livrée ou retournée.",
  },
  {
    key: "returnCost",
    label: "Coût d'un retour",
    unit: "DA",
    help: "Ce que le transporteur facture pour une commande refusée ou retournée.",
  },
  {
    key: "lowStockThreshold",
    label: "Seuil de stock faible",
    unit: "unités",
    help: "Un produit passe en « Stock faible » quand son stock total est inférieur ou égal à ce nombre.",
  },
];

export function SettingsPage() {
  const query = useQuery({ queryKey: ["admin", "settings"], queryFn: fetchAdminSettings });
  return (
    <>
      <AdminPageHeader title="Paramètres" subtitle="Coûts, seuils et sécurité du compte" />
      <div className="mt-7 max-w-2xl">
        {query.isPending ? (
          <AdminEmpty>Chargement…</AdminEmpty>
        ) : query.isError || !query.data ? (
          <AdminEmpty tone="error">Impossible de charger les paramètres.</AdminEmpty>
        ) : (
          <SettingsForm settings={query.data} />
        )}
      </div>
      <div className="max-w-3xl">
        <SecuritySection />
      </div>
    </>
  );
}

function SettingsForm({ settings }: { settings: AdminSettings }) {
  const id = useId();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [values, setValues] = useState<Record<keyof AdminSettings, string>>({
    packagingCost: String(settings.packagingCost),
    returnCost: String(settings.returnCost),
    lowStockThreshold: String(settings.lowStockThreshold),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: saveAdminSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin", "settings"], saved);
      void queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      showToast({
        title: "Paramètres enregistrés",
        message:
          "Les nouveaux coûts s'appliquent aux commandes livrées ou retournées à partir de maintenant.",
        tone: "success",
      });
    },
    onError: (error) =>
      setErrors(
        error instanceof ApiError
          ? Object.keys(error.fields).length > 0
            ? error.fields
            : { form: error.message }
          : { form: "Enregistrement impossible." },
      ),
  });

  const dirty = FIELDS.some(({ key }) => values[key] !== String(settings[key]));

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        // Only the fields that changed are validated and sent (partial update).
        const changed = FIELDS.filter(({ key }) => values[key] !== String(settings[key]));
        const parsed = parseAdminSettingsInput(
          Object.fromEntries(changed.map(({ key }) => [key, values[key]])),
        );
        if (!parsed.success) {
          setErrors(parsed.errors);
          return;
        }
        setErrors({});
        save.mutate(parsed.data);
      }}
    >
      <AdminCard title="Coûts et stock">
        <div className="divide-y divide-line">
          {FIELDS.map(({ key, label, unit, help }) => (
            <div
              key={key}
              className="grid gap-2 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_11rem] sm:gap-6"
            >
              <div>
                <label htmlFor={`${id}-${key}`} className="text-[15px] font-semibold">
                  {label}
                </label>
                <p className="mt-0.5 text-sm text-stone">{help}</p>
              </div>
              <div>
                <div className="relative">
                  <input
                    id={`${id}-${key}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={values[key]}
                    onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                    aria-invalid={errors[key] ? true : undefined}
                    aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
                    className={cn(adminInput, "pr-16 tabular-nums")}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-stone">
                    {unit}
                  </span>
                </div>
                {errors[key] && (
                  <p id={`${id}-${key}-error`} className="mt-1 text-sm text-error">
                    {errors[key]}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </AdminCard>
      <p className="mt-3 text-sm text-stone">
        Les coûts sont enregistrés sur chaque commande au moment où elle devient livrée ou retournée
        : les modifier ne change pas le bénéfice des commandes déjà clôturées.
      </p>
      {errors.form && (
        <p role="alert" className="mt-3 text-sm text-error">
          {errors.form}
        </p>
      )}
      <button
        type="submit"
        disabled={!dirty || save.isPending}
        className={buttonClass("primary", "mt-5 h-12 w-full sm:w-auto sm:px-8")}
      >
        {save.isPending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
