"use client";

import { adminChangePasswordFormSchema, type AdminSessionInfo } from "@rassm/shared";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LaptopIcon, SmartphoneIcon } from "@/components/ui/icons";
import { formatDateTime, formatRelativeTime } from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { toServerErrors } from "@/lib/form-errors";
import {
  adminLogout,
  changeAdminPassword,
  fetchAdminSessions,
  revokeAdminSession,
  revokeOtherAdminSessions,
} from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { AdminCard, AdminEmpty, buttonClass } from "./admin-ui";
import { PASSWORD_HINT, PasswordField } from "./auth/auth-fields";
import { useToast } from "./toasts";

// Paramètres > Sécurité: the open sessions (revoke one or all the others) and the password.

const SESSIONS_KEY = ["admin", "security", "sessions"] as const;

export function SecuritySection() {
  return (
    <section id="securite" aria-labelledby="securite-title" className="mt-12 scroll-mt-24">
      <h2
        id="securite-title"
        className="font-display text-[1.9rem] leading-none font-medium uppercase sm:text-[2.2rem]"
      >
        Sécurité
      </h2>
      <p className="mt-2 text-sm text-stone">
        Les appareils connectés à votre compte et votre mot de passe.
      </p>
      <div className="mt-5 space-y-5">
        <SessionsCard />
        <PasswordCard />
      </div>
    </section>
  );
}

function SessionsCard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();
  const [confirmAll, setConfirmAll] = useState(false);
  const query = useQuery({ queryKey: SESSIONS_KEY, queryFn: fetchAdminSessions });
  const sessions = query.data?.sessions ?? [];
  const others = sessions.filter((session) => !session.current).length;

  const revoke = useMutation({
    mutationFn: revokeAdminSession,
    onSuccess: async ({ current }) => {
      if (current) {
        router.replace(adminRoutes.login);
        router.refresh();
        return;
      }
      showToast({ title: "Session déconnectée", tone: "success" });
      await queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
    onError: (error) =>
      showToast({
        title: "Déconnexion impossible",
        message: error instanceof ApiError ? error.message : undefined,
        tone: "error",
      }),
  });

  const revokeOthers = useMutation({
    mutationFn: revokeOtherAdminSessions,
    onSuccess: async ({ closed }) => {
      setConfirmAll(false);
      showToast({
        title: closed > 1 ? `${closed} sessions déconnectées` : "Session déconnectée",
        tone: "success",
      });
      await queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
    onError: (error) =>
      showToast({
        title: "Déconnexion impossible",
        message: error instanceof ApiError ? error.message : undefined,
        tone: "error",
      }),
  });

  return (
    <AdminCard title="Sessions actives">
      {query.isPending ? (
        <AdminEmpty>Chargement…</AdminEmpty>
      ) : query.isError ? (
        <AdminEmpty tone="error">Impossible de charger les sessions.</AdminEmpty>
      ) : (
        <ul className="divide-y divide-line">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              pending={revoke.isPending && revoke.variables === session.id}
              onRevoke={async () => {
                if (session.current) {
                  await adminLogout();
                  router.replace(adminRoutes.login);
                  router.refresh();
                } else {
                  revoke.mutate(session.id);
                }
              }}
            />
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-line pt-4 sm:flex sm:justify-end">
        <button
          type="button"
          disabled={others === 0 || revokeOthers.isPending}
          onClick={() => setConfirmAll(true)}
          className={buttonClass(
            "outline",
            "h-11 w-full px-4 disabled:opacity-50 sm:w-auto",
            "plain",
          )}
        >
          Déconnecter toutes les autres sessions
        </button>
      </div>
      <AdminDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Déconnecter les autres sessions"
      >
        <p className="text-[15px] leading-relaxed text-ash">
          {others > 1 ? `Les ${others} autres sessions seront` : "L'autre session sera"} fermées
          tout de suite. Cet appareil reste connecté.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
            className={buttonClass("dangerSolid", "h-12")}
          >
            {revokeOthers.isPending ? "Déconnexion…" : "Déconnecter"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmAll(false)}
            className={buttonClass("outline", "h-12")}
          >
            Annuler
          </button>
        </div>
      </AdminDialog>
    </AdminCard>
  );
}

function SessionRow({
  session,
  pending,
  onRevoke,
}: {
  session: AdminSessionInfo;
  pending: boolean;
  onRevoke: () => void;
}) {
  const Icon = session.deviceType === "mobile" ? SmartphoneIcon : LaptopIcon;
  const place = [session.location ?? "Lieu inconnu", session.ip].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-cream text-ink">
          <Icon width={20} height={20} />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] font-semibold">
            {session.browser} · {session.os}
            {session.current && (
              <span className="rounded-sm bg-ink px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-paper uppercase">
                Cet appareil
              </span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-ash">{place}</p>
          <p className="mt-0.5 text-[13px] text-stone">
            Dernière activité : {formatRelativeTime(session.lastActivityAt)} · Connexion le{" "}
            {formatDateTime(session.createdAt)} ·{" "}
            {session.remember ? "Se souvenir de moi (30\u00a0jours)" : "Session de 12\u00a0h"}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={onRevoke}
        className={buttonClass(
          session.current ? "outline" : "danger",
          "h-10 shrink-0 px-4 sm:w-auto",
          "plain",
        )}
      >
        {pending ? "Déconnexion…" : session.current ? "Se déconnecter" : "Déconnecter"}
      </button>
    </li>
  );
}

function PasswordCard() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: adminChangePasswordFormSchema },
    onSubmit: async ({ value, formApi }) => {
      setError(null);
      try {
        const { closedSessions } = await changeAdminPassword({
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
        });
        formApi.reset();
        showToast({
          title: "Mot de passe modifié",
          message:
            closedSessions > 0
              ? `${closedSessions} autre${closedSessions > 1 ? "s sessions déconnectées" : " session déconnectée"}.`
              : "Aucune autre session n'était ouverte.",
          tone: "success",
        });
        await queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      } catch (caught) {
        if (caught instanceof ApiError && Object.keys(caught.fields).length > 0) {
          const { errors, unknownMessages } = toServerErrors(caught.fields, [
            "currentPassword",
            "newPassword",
          ]);
          formApi.setErrorMap({ onDynamic: errors });
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

  const fields = [
    { name: "currentPassword", label: "Mot de passe actuel", autoComplete: "current-password" },
    { name: "newPassword", label: "Nouveau mot de passe", autoComplete: "new-password" },
    { name: "confirmPassword", label: "Confirmer le nouveau", autoComplete: "new-password" },
  ] as const;

  return (
    <AdminCard title="Changer le mot de passe">
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
        className="max-w-xl space-y-5"
      >
        <p className="text-sm leading-relaxed text-ash">
          Les autres appareils connectés seront déconnectés. Cet appareil reste connecté.
        </p>
        {fields.map(({ name, label, autoComplete }) => (
          <form.Field key={name} name={name}>
            {(field) => {
              const fieldError = field.state.meta.errors[0]?.message;
              return (
                <PasswordField
                  id={`security-${name}`}
                  label={label}
                  error={fieldError}
                  hint={name === "newPassword" ? PASSWORD_HINT : undefined}
                  autoComplete={autoComplete}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              );
            }}
          </form.Field>
        ))}
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <button
              type="submit"
              disabled={isSubmitting}
              className={buttonClass("primary", "h-12 w-full sm:w-auto sm:px-8")}
            >
              {isSubmitting ? "Enregistrement…" : "Changer le mot de passe"}
            </button>
          )}
        </form.Subscribe>
        <p className="text-xs text-stone">
          Une alerte est envoyée par e-mail à chaque changement de mot de passe.
        </p>
      </form>
    </AdminCard>
  );
}
