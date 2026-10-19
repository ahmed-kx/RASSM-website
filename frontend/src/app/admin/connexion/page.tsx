import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { adminRoutes } from "@/lib/admin/routes";
import { getAdminSession } from "@/lib/data/admin-session";

export const metadata: Metadata = { title: "Connexion" };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/connexion">) {
  if (await getAdminSession()) redirect(adminRoutes.orders);
  const next = (await searchParams).suivant;
  return (
    <div className="flex min-h-svh flex-col bg-onyx text-paper">
      <div className="flex flex-1 flex-col justify-end px-6 pt-16 pb-10 sm:items-center sm:justify-center">
        <p className="font-display text-[2.75rem] leading-none tracking-[0.12em]">RASSM</p>
        <p className="mt-2 text-[11px] font-semibold tracking-wide-label text-mist uppercase">
          Tableau de bord
        </p>
      </div>
      <div className="bg-bone px-6 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-ink sm:mx-auto sm:mb-16 sm:w-full sm:max-w-md sm:p-10">
        <h1 className="font-display text-3xl leading-none font-medium uppercase">Connexion</h1>
        <p className="mt-2 text-sm text-ash">Réservé à l&apos;équipe RASSM.</p>
        <div className="mt-6">
          <LoginForm next={typeof next === "string" ? next : null} />
        </div>
      </div>
    </div>
  );
}
