import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AdminProviders } from "@/components/admin/admin-providers";

export const metadata: Metadata = {
  title: { default: "Tableau de bord", template: "%s | Admin RASSM" },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The dashboard: its own layout (no site header, footer or Meta Pixel), never indexed.
 * Rendered on every request (never cached), so each page gets the nonce of its strict
 * Content-Security-Policy (proxy.ts).
 */
export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  return <AdminProviders>{children}</AdminProviders>;
}
