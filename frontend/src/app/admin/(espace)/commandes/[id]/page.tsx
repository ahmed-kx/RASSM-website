import type { Metadata } from "next";
import { OrderDetail } from "@/components/admin/order-detail";

export const metadata: Metadata = { title: "Commande" };

export default async function AdminOrderPage({ params }: PageProps<"/admin/commandes/[id]">) {
  const { id } = await params;
  return <OrderDetail id={id} />;
}
