import type { Metadata } from "next";
import { SettingsPage } from "@/components/admin/settings-page";

export const metadata: Metadata = { title: "Paramètres" };

export default function Page() {
  return <SettingsPage />;
}
