"use client";

import {
  INVALID_RESET_LINK,
  adminNewPasswordFormSchema,
  passwordResetTokenSchema,
} from "@rassm/shared";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { toServerErrors } from "@/lib/form-errors";
import { resetAdminPassword } from "@/lib/data/admin";
import { AuthAlert, AuthSubmit, PASSWORD_HINT, PasswordField, authLink } from "./auth-fields";

// The token is in the link's fragment (#jeton=…): never sent to a server or kept in logs. It is
// read once, then removed from the address bar.
let token: string | null | undefined;
function readToken(): string | null {
  if (token === undefined) {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("jeton");
    token = passwordResetTokenSchema.safeParse(value).success ? value : null;
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }
  return token;
}
// The fragment is read once: nothing to subscribe to.
const subscribe = () => () => {
  /* no updates */
};

/** The page opened from the reset e-mail: choose the new password (typed twice). */
export function NewPasswordForm() {
  const router = useRouter();
  const resetToken = useSyncExternalStore(subscribe, readToken, () => undefined);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: adminNewPasswordFormSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await resetAdminPassword({ token: resetToken ?? "", password: value.password });
        router.replace(`${adminRoutes.login}?motdepasse=modifie`);
      } catch (caught) {
        if (caught instanceof ApiError && Object.keys(caught.fields).length > 0) {
          const { errors, unknownMessages } = toServerErrors(caught.fields, ["password"]);
          form.setErrorMap({ onDynamic: errors });
          setError(unknownMessages[0] ?? null);
          return;
        }
        setError(caught instanceof ApiError ? caught.message : "Enregistrement impossible.");
      }
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
  });

  if (resetToken === undefined) return null;
  if (resetToken === null || error === INVALID_RESET_LINK) {
    return (
      <div className="space-y-[max(14px,calc(20*var(--u,1px)))]">
        <AuthAlert>{INVALID_RESET_LINK}</AuthAlert>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Link href={adminRoutes.forgotPassword} className={authLink}>
            Demander un nouveau lien
          </Link>
          <Link href={adminRoutes.login} className={authLink}>
            Retour à la connexion
          </Link>
        </div>
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
      <form.Field name="password">
        {(field) => {
          const fieldError = field.state.meta.errors[0]?.message;
          return (
            <PasswordField
              id="new-password"
              label="Nouveau mot de passe"
              error={fieldError}
              hint={PASSWORD_HINT}
              autoComplete="new-password"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
            />
          );
        }}
      </form.Field>
      <form.Field name="confirmPassword">
        {(field) => {
          const fieldError = field.state.meta.errors[0]?.message;
          return (
            <PasswordField
              id="confirm-password"
              label="Confirmer"
              error={fieldError}
              autoComplete="new-password"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
            />
          );
        }}
      </form.Field>
      {error && <AuthAlert>{error}</AuthAlert>}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <AuthSubmit
            pending={isSubmitting}
            label="Enregistrer le mot de passe"
            pendingLabel="Enregistrement…"
          />
        )}
      </form.Subscribe>
    </form>
  );
}
