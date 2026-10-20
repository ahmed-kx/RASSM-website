import type { Metadata } from "next";
import { Suspense } from "react";
import { DeliveryPage } from "@/components/admin/delivery-page";

export const metadata: Metadata = { title: "Livraison" };

export default function AdminDeliveryPage() {
  return (
    <Suspense>
      <DeliveryPage />
    </Suspense>
  );
}
