import type { Metadata } from "next";
import { AuthShell } from "@/components/admin/auth/auth-shell";
import { NewPasswordForm } from "@/components/admin/auth/new-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function NewPasswordPage() {
  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle={
        <p>Choisissez un nouveau mot de passe. Toutes les sessions ouvertes seront déconnectées.</p>
      }
    >
      <NewPasswordForm />
    </AuthShell>
  );
}
