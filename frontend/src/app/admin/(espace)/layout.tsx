import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { adminRoutes } from "@/lib/admin/routes";
import { getAdminSession } from "@/lib/data/admin-session";

/** Every dashboard page except the login: the session is checked with the API. */
export default async function AdminSpaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  const admin = await getAdminSession();
  if (!admin) redirect(adminRoutes.login);
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
