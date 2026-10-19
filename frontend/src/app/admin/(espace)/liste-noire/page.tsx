import type { Metadata } from "next";
import { BlacklistPage } from "@/components/admin/blacklist-page";

export const metadata: Metadata = { title: "Liste noire" };

export default function AdminBlacklistPage() {
  return <BlacklistPage />;
}
