import type { Metadata } from "next";
import { ClientDetail } from "@/components/admin/client-detail";

export const metadata: Metadata = { title: "Client" };

export default async function AdminClientPage({ params }: PageProps<"/admin/clients/[phone]">) {
  const { phone } = await params;
  return <ClientDetail phone={decodeURIComponent(phone)} />;
}
