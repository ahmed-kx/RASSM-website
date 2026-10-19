import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminProviders } from "@/components/admin/admin-providers";

export const metadata: Metadata = {
  title: { default: "Tableau de bord", template: "%s | Admin RASSM" },
  robots: { index: false, follow: false, nocache: true },
};

/** The dashboard: its own layout (no site header, footer or Meta Pixel), never indexed. */
export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AdminProviders>{children}</AdminProviders>;
}
