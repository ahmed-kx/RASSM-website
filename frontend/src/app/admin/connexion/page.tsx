import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/admin/auth/auth-shell";
import { LoginForm } from "@/components/admin/login-form";
import { adminRoutes } from "@/lib/admin/routes";
import { getAdminSession } from "@/lib/data/admin-session";

export const metadata: Metadata = { title: "Connexion" };

const NOTICES: Record<string, string> = {
  modifie: "Mot de passe modifié. Connectez-vous avec le nouveau mot de passe.",
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/connexion">) {
  if (await getAdminSession()) redirect(adminRoutes.orders);
  const { suivant, motdepasse } = await searchParams;
  return (
    <AuthShell
      title="Connexion"
      subtitle={
        <p>
          Accédez à votre espace RASSM.
          <br />
          Gérez vos produits, commandes et clients.
        </p>
      }
    >
      <LoginForm
        next={typeof suivant === "string" ? suivant : null}
        notice={typeof motdepasse === "string" ? (NOTICES[motdepasse] ?? null) : null}
      />
    </AuthShell>
  );
}
