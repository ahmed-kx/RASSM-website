import type { Metadata } from "next";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata: Metadata = { title: "Nouveau produit" };

export default function AdminNewProductPage() {
  return <ProductEditor />;
}
