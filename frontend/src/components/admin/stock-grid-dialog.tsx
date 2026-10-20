"use client";

import {
  LOW_VARIANT_STOCK,
  SIZES,
  isLowVariantStock,
  type Product,
  type Size,
  type StockBySize,
} from "@rassm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fetchAdminProduct, updateProductStock } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { buttonClass } from "./admin-ui";
import { useToast } from "./toasts";

/** One size: big touch target, − / + buttons, typing allowed. 1 to 3 units: ochre. */
export function StockCell({
  id,
  size,
  value,
  onChange,
  onBlur,
  error,
}: {
  id: string;
  size: Size;
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const low = !error && isLowVariantStock(value);
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="block text-center text-[11px] font-semibold tracking-[0.12em] text-ash"
      >
        {size}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        title={low ? "Stock faible pour cette taille" : undefined}
        className={cn(
          "mt-1 h-12 w-full [appearance:textfield] rounded-sm border text-center text-base tabular-nums focus:border-ink focus:outline-none [&::-webkit-inner-spin-button]:appearance-none",
          error
            ? "border-error bg-paper"
            : low
              ? "border-warning bg-warning/10 font-semibold text-warning"
              : "border-line bg-paper",
          !error && value === 0 && "text-stone",
        )}
      />
      <div className="mt-1 grid grid-cols-2 gap-1">
        <button
          type="button"
          aria-label={`Retirer 1 en ${size}`}
          disabled={!(value > 0)}
          onClick={() => onChange(Math.max(0, (value || 0) - 1))}
          className="grid h-9 place-items-center rounded-sm border border-line bg-paper disabled:opacity-40"
        >
          <MinusIcon width={14} height={14} />
        </button>
        <button
          type="button"
          aria-label={`Ajouter 1 en ${size}`}
          onClick={() => onChange((value || 0) + 1)}
          className="grid h-9 place-items-center rounded-sm border border-line bg-paper"
        >
          <PlusIcon width={14} height={14} />
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[11px] leading-tight text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Legend under a stock grid. */
export function LowVariantHint() {
  return (
    <p className="flex items-center gap-2 text-xs text-stone">
      <span aria-hidden="true" className="size-3 rounded-sm border border-warning bg-warning/10" />
      Encadré ocre : {LOW_VARIANT_STOCK} unités ou moins dans cette taille.
    </p>
  );
}

/** The five sizes of one color. */
export function StockGrid({
  stock,
  onChange,
  idPrefix,
}: {
  stock: StockBySize;
  onChange: (size: Size, value: number) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {SIZES.map((size) => (
        <StockCell
          key={size}
          id={`${idPrefix}-${size}`}
          size={size}
          value={stock[size]}
          onChange={(value) => onChange(size, value)}
        />
      ))}
    </div>
  );
}

/** Quick stock edit from the products list (loads the product fresh). */
export function StockGridDialog({
  productId,
  productName,
  onClose,
}: {
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const query = useQuery({
    queryKey: ["admin", "product", productId],
    queryFn: () => fetchAdminProduct(productId),
  });
  const [draft, setDraft] = useState<Product["colors"] | null>(null);
  const colors = draft ?? query.data?.product.colors ?? [];

  const save = useMutation({
    mutationFn: () =>
      updateProductStock(productId, {
        updatedAt: query.data?.updatedAt,
        colors: colors.map((color) => ({ name: color.name, stock: color.stock })),
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(["admin", "product", productId], detail);
      void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      showToast({ title: "Stock enregistré", message: productName, tone: "success" });
      onClose();
    },
    onError: (error) =>
      showToast({
        title: "Stock non enregistré",
        message: error instanceof ApiError ? error.message : undefined,
        tone: "error",
      }),
  });

  const setStock = (colorIndex: number, size: Size, value: number) =>
    setDraft(
      colors.map((color, index) =>
        index === colorIndex ? { ...color, stock: { ...color.stock, [size]: value } } : color,
      ),
    );
  const invalid = colors.some((color) =>
    SIZES.some((size) => !Number.isInteger(color.stock[size]) || color.stock[size] < 0),
  );

  return (
    <AdminDialog open onClose={onClose} title="Modifier le stock">
      <p className="text-sm text-ash">{productName} · 0 = taille non vendue ou épuisée.</p>
      {query.isPending ? (
        <p className="py-8 text-center text-sm text-stone">Chargement…</p>
      ) : query.isError ? (
        <p role="alert" className="py-8 text-center text-sm text-error">
          Impossible de charger le produit.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {colors.map((color, colorIndex) => (
            <fieldset key={color.name}>
              <legend className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span
                  aria-hidden="true"
                  className="size-4 rounded-full border border-line"
                  style={{ backgroundColor: color.hex }}
                />
                {color.name}
              </legend>
              <StockGrid
                idPrefix={`stock-${colorIndex}`}
                stock={color.stock}
                onChange={(size, value) => setStock(colorIndex, size, value)}
              />
            </fieldset>
          ))}
          <LowVariantHint />
          {invalid && (
            <p role="alert" className="text-sm text-error">
              Chaque taille doit avoir un nombre entier, 0 ou plus.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={invalid || save.isPending || draft === null}
              onClick={() => save.mutate()}
              className={buttonClass("primary", "h-12")}
            >
              {save.isPending ? "Enregistrement…" : "Enregistrer le stock"}
            </button>
            <button type="button" onClick={onClose} className={buttonClass("outline", "h-12")}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </AdminDialog>
  );
}
