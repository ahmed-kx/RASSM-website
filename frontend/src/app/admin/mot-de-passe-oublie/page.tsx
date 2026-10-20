import type { Metadata } from "next";
import { AuthShell } from "@/components/admin/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/admin/auth/forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle={
        <p>
          Indiquez l&apos;e-mail de votre compte administrateur. Si ce compte existe, vous recevrez
          un lien pour choisir un nouveau mot de passe.
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
