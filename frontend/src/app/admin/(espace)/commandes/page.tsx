import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersPage } from "@/components/admin/orders-page";

export const metadata: Metadata = { title: "Commandes" };

export default function AdminOrdersPage() {
  return (
    <Suspense>
      <OrdersPage />
    </Suspense>
  );
}
