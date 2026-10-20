import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsPage } from "@/components/admin/products-page";

export const metadata: Metadata = { title: "Produits" };

export default function AdminProductsPage() {
  return (
    <Suspense>
      <ProductsPage />
    </Suspense>
  );
}
