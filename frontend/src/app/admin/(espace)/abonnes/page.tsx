import type { Metadata } from "next";
import { Suspense } from "react";
import { SubscribersPage } from "@/components/admin/subscribers-page";

export const metadata: Metadata = { title: "Abonnés" };

export default function Page() {
  return (
    <Suspense>
      <SubscribersPage />
    </Suspense>
  );
}
