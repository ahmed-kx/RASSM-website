import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardPage } from "@/components/admin/dashboard-page";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function Page() {
  return (
    <Suspense>
      <DashboardPage />
    </Suspense>
  );
}
