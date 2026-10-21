"use client";

import { CONTACT_SUBJECT_LABELS, type AdminMessage } from "@rassm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArchiveIcon,
  MailIcon,
  MailOpenIcon,
  PhoneIcon,
  TrashIcon,
  WhatsAppIcon,
} from "@/components/ui/icons";
import { formatDateTime, formatPhone, telLink, whatsAppLink } from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { deleteMessage, fetchMessage, updateMessage } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { AdminCard, AdminEmpty, InfoRow, InitialAvatar, buttonClass } from "./admin-ui";
import { Pill } from "./badges";
import { useToast } from "./toasts";

/** One contact message (opening it marks it read): reply by phone, WhatsApp or e-mail. */
export function MessageDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const query = useQuery({ queryKey: ["admin", "message", id], queryFn: () => fetchMessage(id) });

  // Opening it marked it read: refresh the counters and the list.
  useEffect(() => {
    if (!query.data) return;
    void queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "updates"] });
  }, [query.data, queryClient]);

  const fail = (title: string) => (error: unknown) =>
    showToast({
      title,
      message: error instanceof ApiError ? error.message : undefined,
      tone: "error",
    });
  const update = useMutation({
    mutationFn: (change: { read?: boolean; archived?: boolean }) => updateMessage(id, change),
    onSuccess: (message, change) => {
      queryClient.setQueryData(["admin", "message", id], message);
      void queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "updates"] });
      showToast({
        title:
          change.archived === true
            ? "Message archivé"
            : change.archived === false
              ? "Message remis dans la boîte"
              : change.read
                ? "Marqué comme lu"
                : "Marqué comme non lu",
        tone: "success",
      });
      if (change.archived === true || change.read === false) router.push(adminRoutes.messages);
    },
    onError: fail("Modification impossible"),
  });
  const remove = useMutation({
    mutationFn: () => deleteMessage(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "updates"] });
      showToast({ title: "Message supprimé", tone: "success" });
      router.push(adminRoutes.messages);
    },
    onError: fail("Suppression impossible"),
  });

  if (query.isPending) return <AdminEmpty>Chargement du message…</AdminEmpty>;
  if (query.isError || !query.data) {
    return (
      <AdminEmpty tone="error">
        {query.error instanceof ApiError
          ? query.error.message
          : "Impossible de charger ce message."}
      </AdminEmpty>
    );
  }
  const message: AdminMessage = query.data;
  const name = `${message.firstName} ${message.lastName}`;
  const subject = CONTACT_SUBJECT_LABELS[message.subject];

  return (
    <>
      <div className="flex min-w-0 items-center gap-4">
        <InitialAvatar name={name} size="lg" />
        <div className="min-w-0">
          <h1 className="font-display text-[2.2rem] leading-none font-medium uppercase sm:text-[2.7rem]">
            {name}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ash">
            <Pill tone="sand" size="sm">
              {subject}
            </Pill>
            {message.archived && (
              <Pill tone="ink" size="sm">
                Archivé
              </Pill>
            )}
            {message.suspicious && (
              <Pill tone="warning" size="sm" title={message.suspiciousReason ?? undefined}>
                Suspect{message.suspiciousReason ? ` : ${message.suspiciousReason}` : ""}
              </Pill>
            )}
            Reçu le {formatDateTime(message.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
        <a href={telLink(message.phone)} className={buttonClass("primary", "h-12")}>
          <PhoneIcon width={19} height={19} /> Appeler
        </a>
        <a
          href={whatsAppLink(message.phone, `Bonjour ${message.firstName}, ici RASSM. `)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("outline", "h-12")}
        >
          <WhatsAppIcon width={19} height={19} /> WhatsApp
        </a>
        {message.email && (
          <a
            href={`mailto:${message.email}?subject=${encodeURIComponent(`RASSM : votre message (${subject})`)}`}
            className={buttonClass("outline", "h-12")}
          >
            <MailIcon width={19} height={19} /> Répondre par e-mail
          </a>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AdminCard title="Message">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.message}</p>
        </AdminCard>
        <div className="space-y-4">
          <AdminCard title="Contact">
            <dl>
              <InfoRow label="Téléphone">{formatPhone(message.phone)}</InfoRow>
              <InfoRow label="E-mail">{message.email ?? "—"}</InfoRow>
              <InfoRow label="Sujet">{subject}</InfoRow>
            </dl>
          </AdminCard>
          <AdminCard title="Actions">
            <div className="grid gap-2">
              <button
                type="button"
                disabled={update.isPending}
                onClick={() => update.mutate({ read: !message.read })}
                className={buttonClass("outline", "h-11", "plain")}
              >
                {message.read ? (
                  <>
                    <MailIcon width={18} height={18} /> Marquer comme non lu
                  </>
                ) : (
                  <>
                    <MailOpenIcon width={18} height={18} /> Marquer comme lu
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={update.isPending}
                onClick={() => update.mutate({ archived: !message.archived })}
                className={buttonClass("outline", "h-11", "plain")}
              >
                <ArchiveIcon width={18} height={18} />
                {message.archived ? "Remettre dans la boîte" : "Archiver"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className={buttonClass("danger", "h-11", "plain")}
              >
                <TrashIcon width={18} height={18} /> Supprimer
              </button>
            </div>
          </AdminCard>
        </div>
      </div>

      <AdminDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer ce message ?"
      >
        <p className="text-[15px] leading-relaxed text-ash">
          Le message de {name} sera supprimé définitivement. Pour le garder sans l&apos;avoir dans
          la boîte, archivez-le plutôt.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
            className={buttonClass("dangerSolid", "h-12")}
          >
            {remove.isPending ? "Suppression…" : "Supprimer"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className={buttonClass("outline", "h-12")}
          >
            Annuler
          </button>
        </div>
      </AdminDialog>
    </>
  );
}
