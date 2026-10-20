import type { Metadata } from "next";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata: Metadata = { title: "Produit" };

export default async function AdminProductPage({ params }: PageProps<"/admin/produits/[id]">) {
  const { id } = await params;
  return <ProductEditor id={id} />;
}
