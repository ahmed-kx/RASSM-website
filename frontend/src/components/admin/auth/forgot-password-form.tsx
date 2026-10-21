"use client";

import { adminForgotPasswordSchema } from "@rassm/shared";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRef, useState } from "react";
import { MailIcon } from "@/components/ui/icons";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { requestPasswordReset } from "@/lib/data/admin";
import { AuthAlert, AuthField, AuthInput, AuthSubmit, authLink } from "./auth-fields";

/** "Mot de passe oublié ?": always the same neutral answer, whether the account exists or not. */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: adminForgotPasswordSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        const { message } = await requestPasswordReset(adminForgotPasswordSchema.parse(value));
        setSent(message);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "Envoi impossible. Réessayez.");
      }
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
  });

  if (sent) {
    return (
      <div className="space-y-[max(14px,calc(20*var(--u,1px)))]">
        <AuthAlert tone="info">{sent}</AuthAlert>
        <p className="font-auth text-[13px] leading-relaxed font-light text-ash">
          Pensez à regarder dans les courriers indésirables. Le lien ne fonctionne qu&apos;une fois.
        </p>
        <Link href={adminRoutes.login} className={authLink}>
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-[max(14px,calc(20*var(--u,1px)))]"
    >
      <form.Field name="email">
        {(field) => {
          const fieldError = field.state.meta.errors[0]?.message;
          return (
            <AuthField id="reset-email" label="E-mail" icon={MailIcon} error={fieldError}>
              <AuthInput
                id="reset-email"
                error={fieldError}
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                placeholder="votre@email.com"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            </AuthField>
          );
        }}
      </form.Field>
      {error && <AuthAlert>{error}</AuthAlert>}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <AuthSubmit pending={isSubmitting} label="Envoyer le lien" pendingLabel="Envoi…" />
        )}
      </form.Subscribe>
      <p>
        <Link href={adminRoutes.login} className={authLink}>
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
