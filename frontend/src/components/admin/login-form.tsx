"use client";

import { adminLoginSchema } from "@rassm/shared";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, describedBy, inputClasses } from "@/components/ui/form-field";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { adminLogin } from "@/lib/data/admin";

/** Only dashboard paths are accepted as the page to open after login. */
function safeNext(next: string | null): string {
  return next && /^\/admin(\/|$)/.test(next) && !next.startsWith("//") ? next : adminRoutes.orders;
}

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: adminLoginSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await adminLogin(adminLoginSchema.parse(value));
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
      className="space-y-5"
    >
      <form.Field name="email">
        {(field) => {
          const fieldError = field.state.meta.errors[0]?.message;
          return (
            <FormField id="admin-email" label="E-mail" error={fieldError}>
              <input
                id="admin-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                {...describedBy("admin-email", fieldError)}
                className={inputClasses}
              />
            </FormField>
          );
        }}
      </form.Field>
      <form.Field name="password">
        {(field) => {
          const fieldError = field.state.meta.errors[0]?.message;
          return (
            <FormField id="admin-password" label="Mot de passe" error={fieldError}>
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                {...describedBy("admin-password", fieldError)}
                className={inputClasses}
              />
            </FormField>
          );
        }}
      </form.Field>
      {error && (
        <p role="alert" className="border-l-2 border-error pl-3 text-sm text-error">
          {error}
        </p>
      )}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type="submit"
            surface="light"
            disabled={isSubmitting}
            withArrow={!isSubmitting}
            className="w-full disabled:opacity-60"
          >
            {isSubmitting ? "Connexion…" : "Se connecter"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
