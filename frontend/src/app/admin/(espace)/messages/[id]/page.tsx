import type { Metadata } from "next";
import { MessageDetail } from "@/components/admin/message-detail";

export const metadata: Metadata = { title: "Message" };

export default async function AdminMessagePage({ params }: PageProps<"/admin/messages/[id]">) {
  const { id } = await params;
  return <MessageDetail id={id} />;
}
