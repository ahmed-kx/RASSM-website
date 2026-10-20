"use client";

import { formatPrice, formatWilaya, getWilaya } from "@rassm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BanIcon, ChevronRightIcon, PhoneIcon, WhatsAppIcon } from "@/components/ui/icons";
import {
  formatDateTime,
  formatPhone,
  formatTableDate,
  telLink,
  whatsAppLink,
} from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { addToBlacklist, fetchClient, removeFromBlacklist } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import {
  AdminCard,
  AdminEmpty,
  InfoRow,
  InitialAvatar,
  adminInput,
  adminLabel,
  buttonClass,
} from "./admin-ui";
import { StatusBadge } from "./badges";
import { ClientBadges } from "./clients-page";
import { formatNumber } from "./stats-ui";
import { useToast } from "./toasts";

/** One client: summary, call / WhatsApp, every order, blacklist. */
export function ClientDetail({ phone }: { phone: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [blacklisting, setBlacklisting] = useState(false);
  const [reason, setReason] = useState("");
  const query = useQuery({
    queryKey: ["admin", "client", phone],
    queryFn: () => fetchClient(phone),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "client", phone] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "blacklist"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
  };
  const fail = (title: string) => (error: unknown) =>
    showToast({
      title,
      message: error instanceof ApiError ? error.message : undefined,
      tone: "error",
    });
  const add = useMutation({
    mutationFn: () => addToBlacklist(phone, reason),
    onSuccess: () => {
      refresh();
      setBlacklisting(false);
      setReason("");
      showToast({ title: "Numéro ajouté à la liste noire" });
    },
    onError: fail("Ajout impossible"),
  });
  const remove = useMutation({
    mutationFn: () => removeFromBlacklist(phone),
    onSuccess: () => {
      refresh();
      showToast({ title: "Numéro retiré de la liste noire" });
    },
    onError: fail("Suppression impossible"),
  });

  if (query.isPending) return <AdminEmpty>Chargement du client…</AdminEmpty>;
  if (query.isError || !query.data) {
    return (
      <AdminEmpty tone="error">
        {query.error instanceof ApiError ? query.error.message : "Impossible de charger ce client."}
      </AdminEmpty>
    );
  }
  const { client, orders, blacklist } = query.data;
  const wilaya = getWilaya(client.wilayaCode);
  const firstName = client.name.trim().split(/\s+/)[0] ?? "";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <InitialAvatar name={client.name} size="lg" />
          <div className="min-w-0">
            <h1 className="font-display text-[2.2rem] leading-none font-medium uppercase sm:text-[2.7rem]">
              {client.name}
            </h1>
            <p className="mt-1.5 text-sm text-ash tabular-nums">{formatPhone(client.phone)}</p>
            <div className="mt-2 empty:hidden">
              <ClientBadges badges={client.badges} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
        <a href={telLink(client.phone)} className={buttonClass("primary", "h-12")}>
          <PhoneIcon width={19} height={19} /> Appeler
        </a>
        <a
          href={whatsAppLink(client.phone, `Bonjour ${firstName}, ici RASSM.`)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("outline", "h-12")}
        >
          <WhatsAppIcon width={19} height={19} /> WhatsApp
        </a>
        {blacklist ? (
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
            className={buttonClass("outline", "h-12")}
          >
            Retirer de la liste noire
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setBlacklisting(true)}
            className={buttonClass("danger", "h-12")}
          >
            <BanIcon width={18} height={18} /> Liste noire
          </button>
        )}
      </div>

      {blacklist && (
        <p className="mt-4 rounded-md border border-error/40 bg-error/5 px-4 py-3 text-sm text-error">
          Sur la liste noire depuis le {formatDateTime(blacklist.createdAt)} : {blacklist.reason}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <AdminCard title="Client">
          <dl>
            <InfoRow label="Téléphone">{formatPhone(client.phone)}</InfoRow>
            <InfoRow label="Wilaya">{wilaya ? formatWilaya(wilaya) : client.wilayaCode}</InfoRow>
            <InfoRow label="Commandes">{formatNumber(client.orders)}</InfoRow>
            <InfoRow label="Livrées">{formatNumber(client.delivered)}</InfoRow>
            <InfoRow label="Retournées">{formatNumber(client.returned)}</InfoRow>
            <InfoRow label="Première commande">{formatDateTime(client.firstOrderAt)}</InfoRow>
            <InfoRow label="Dernière commande">{formatDateTime(client.lastOrderAt)}</InfoRow>
            <InfoRow label="Total dépensé (livrées)" strong>
              {formatPrice(client.spent)}
            </InfoRow>
          </dl>
        </AdminCard>

        <AdminCard title={`Commandes (${formatNumber(orders.length)})`}>
          <ul className="divide-y divide-line">
            {orders.map((order) => {
              const date = formatTableDate(order.createdAt);
              return (
                <li
                  key={order.id}
                  className="relative flex items-center gap-3 py-3 hover:bg-cream/40"
                >
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-cream">
                    {order.image && (
                      <Image
                        src={order.image}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-contain"
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={adminRoutes.order(order.id)}
                      className="block truncate text-[15px] font-semibold after:absolute after:inset-0 after:content-['']"
                    >
                      {order.productName}
                    </Link>
                    <p className="truncate text-[13px] text-ash">
                      {order.color} · {order.size} · ×{order.quantity} · {order.commune}
                    </p>
                    <p className="text-xs text-stone tabular-nums">
                      {order.orderNumber} · {date.day} {date.time}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={order.status} />
                    <span className="text-sm tabular-nums">{formatPrice(order.total)}</span>
                  </div>
                  <ChevronRightIcon
                    width={18}
                    height={18}
                    className="hidden shrink-0 text-ash sm:block"
                  />
                </li>
              );
            })}
          </ul>
        </AdminCard>
      </div>

      <AdminDialog
        open={blacklisting}
        onClose={() => setBlacklisting(false)}
        title="Ajouter à la liste noire ?"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim().length >= 3) add.mutate();
          }}
        >
          <p className="text-[15px] leading-relaxed text-ash">
            Les prochaines commandes de {formatPhone(client.phone)} seront toujours enregistrées,
            mais signalées « Liste noire ».
          </p>
          <label className="mt-4 block">
            <span className={adminLabel}>Raison</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Colis refusé"
              maxLength={200}
              className={cn(adminInput, "mt-1.5")}
            />
          </label>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button
              type="submit"
              disabled={add.isPending || reason.trim().length < 3}
              className={buttonClass("dangerSolid", "h-12")}
            >
              {add.isPending ? "Ajout…" : "Ajouter"}
            </button>
            <button
              type="button"
              onClick={() => setBlacklisting(false)}
              className={buttonClass("outline", "h-12")}
            >
              Annuler
            </button>
          </div>
        </form>
      </AdminDialog>
    </>
  );
}
