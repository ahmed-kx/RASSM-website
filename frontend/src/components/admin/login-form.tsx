"use client";

import { adminLoginFormSchema } from "@rassm/shared";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckIcon, MailIcon } from "@/components/ui/icons";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { adminLogin } from "@/lib/data/admin";
import {
  AuthAlert,
  AuthField,
  AuthInput,
  AuthSubmit,
  PasswordField,
  authLink,
} from "./auth/auth-fields";

/** Only dashboard paths are accepted as the page to open after login. */
function safeNext(next: string | null): string {
  return next && /^\/admin(\/|$)/.test(next) && !next.startsWith("//") ? next : adminRoutes.orders;
}

export function LoginForm({ next, notice }: { next: string | null; notice: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: { email: "", password: "", remember: false },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: adminLoginFormSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await adminLogin(adminLoginFormSchema.parse(value));
        router.replace(safeNext(next));
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : "Connexion impossible. Veuillez réessayer.",
        );
      }
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
  });

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-6 lg:space-y-[2.2vh]"
    >
      {notice && !error && <AuthAlert tone="info">{notice}</AuthAlert>}
      <form.Field name="email">
        {(field) => {
          const fieldError = field.state.meta.errors[0]?.message;
          return (
            <AuthField id="admin-email" label="E-mail" icon={MailIcon} error={fieldError}>
              <AuthInput
                id="admin-email"
                error={fieldError}
                name="email"
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
      <form.Field name="password">
        {(field) => {
          const fieldError = field.state.meta.errors[0]?.message;
          return (
            <PasswordField
              id="admin-password"
              label="Mot de passe"
              error={fieldError}
              name="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
            />
          );
        }}
      </form.Field>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <form.Field name="remember">
          {(field) => (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <span className="relative grid size-4.5 shrink-0 place-items-center">
                <input
                  type="checkbox"
                  name="remember"
                  checked={field.state.value}
                  onChange={(event) => field.handleChange(event.target.checked)}
                  className="peer absolute inset-0 cursor-pointer appearance-none border border-ink/50 bg-paper checked:border-ink checked:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                />
                <CheckIcon
                  width={13}
                  height={13}
                  strokeWidth={2}
                  className="pointer-events-none relative hidden text-paper peer-checked:block"
                />
              </span>
              Se souvenir de moi
            </label>
          )}
        </form.Field>
        <Link href={adminRoutes.forgotPassword} className={authLink}>
          Mot de passe oublié&nbsp;?
        </Link>
      </div>

      {error && <AuthAlert>{error}</AuthAlert>}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <AuthSubmit pending={isSubmitting} label="Se connecter" pendingLabel="Connexion…" />
        )}
      </form.Subscribe>
    </form>
  );
}
