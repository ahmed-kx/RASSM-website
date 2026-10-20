import type { Metadata } from "next";
import { Suspense } from "react";
import { AdsPage } from "@/components/admin/ads-page";

export const metadata: Metadata = { title: "Publicité" };

export default function Page() {
  return (
    <Suspense>
      <AdsPage />
    </Suspense>
  );
}
