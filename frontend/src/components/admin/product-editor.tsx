"use client";

import { getMaxHomeDeliveryPrice } from "@rassm/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { fetchAdminDeliveryFees, fetchAdminProduct } from "@/lib/data/admin";
import { AdminEmpty } from "./admin-ui";
import { ProductForm } from "./product-form";

/** Loads what the form needs (the product, and the fee table for the tier limit). */
export function ProductEditor({ id }: { id?: string }) {
  const fees = useQuery({ queryKey: ["admin", "delivery-fees"], queryFn: fetchAdminDeliveryFees });
  const product = useQuery({
    queryKey: ["admin", "product", id],
    queryFn: () => fetchAdminProduct(id ?? ""),
    enabled: Boolean(id),
    // The form keeps its own values: no reload while it is being edited.
    refetchOnWindowFocus: false,
  });

  const error = fees.error ?? product.error;
  if (error) {
    return (
      <div className="space-y-4 text-center">
        <AdminEmpty tone="error">
          {error instanceof ApiError ? error.message : "Impossible de charger le produit."}
        </AdminEmpty>
        <Link
          href={adminRoutes.products}
          className="inline-block text-sm underline underline-offset-4"
        >
          Retour aux produits
        </Link>
      </div>
    );
  }
  if (!fees.data || (id && !product.data)) return <AdminEmpty>Chargement…</AdminEmpty>;

  return (
    <ProductForm
      // A new version from the API (after a save) restarts the form from the saved values.
      key={product.data ? `${product.data.product.id}-${product.data.updatedAt}` : "new"}
      detail={product.data}
      maxHomeDeliveryPrice={getMaxHomeDeliveryPrice(fees.data.deliveryFees)}
    />
  );
}
