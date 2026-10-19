"use client";

import {
  EDITABLE_STATUSES,
  ORDER_STATUS_ACTION_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  formatDiscount,
  formatPrice,
  formatWilaya,
  getWilaya,
  type AdminOrder,
  type OrderStatus,
} from "@rassm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BanIcon, EditIcon, PhoneIcon, WhatsAppIcon } from "@/components/ui/icons";
import {
  customerWhatsAppLink,
  deliveryLabel,
  formatDateTime,
  formatPhone,
  telLink,
} from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  blacklistOrderPhone,
  changeOrderStatus,
  fetchAdminOrder,
  saveOrderNote,
} from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { OrderFlags, StatusBadge } from "./badges";
import { OrderEditDialog } from "./order-edit-dialog";
import { useToast } from "./toasts";
import { useSingleFlight } from "./use-single-flight";

/** What the confirmation dialog says before each status change. */
const STATUS_CONFIRM: Record<OrderStatus, string> = {
  pending: "La commande repasse en « Reçue » et les articles sont repris dans le stock.",
  confirmed: "Le client a confirmé par téléphone : la commande pourra être exportée pour Anderson.",
  shipped: "Le colis a été remis à Anderson.",
  delivered: "Le client a reçu et payé son colis.",
  cancelled: "La commande est annulée et les articles reviennent dans le stock.",
  returned: "Le colis est revenu : les articles reviennent dans le stock.",
};

const DANGER: readonly OrderStatus[] = ["cancelled", "returned"];

const BLACKLIST_REASONS = ["Colis refusé", "Injoignable", "Fausse commande"];

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border border-line bg-paper p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-label text-stone uppercase">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 py-1.5",
        strong && "mt-1 border-t border-line pt-3 text-base font-semibold",
      )}
    >
      <dt className={strong ? undefined : "text-ash"}>{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}

const bigButton =
  "flex h-14 items-center justify-center gap-2.5 text-[12px] font-semibold tracking-button uppercase";

export function OrderDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const query = useQuery({ queryKey: ["admin", "order", id], queryFn: () => fetchAdminOrder(id) });

  const applyOrder = (order: AdminOrder) => {
    queryClient.setQueryData(["admin", "order", id], (current: typeof query.data) =>
      current ? { ...current, order } : current,
    );
    void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "updates"] });
  };
  const onError = (title: string) => (error: unknown) =>
    showToast({
      title,
      message: error instanceof ApiError ? error.message : undefined,
      tone: "error",
    });

  const once = useSingleFlight();
  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => changeOrderStatus(id, status),
    onSuccess: (order) => {
      applyOrder(order);
      setPendingStatus(null);
      showToast({
        title: `Commande ${ORDER_STATUS_LABELS[order.status].toLowerCase()}`,
        tone: "success",
      });
      // Stock changed: the product (sizes available for edits) is reloaded.
      void queryClient.invalidateQueries({ queryKey: ["admin", "order", id] });
    },
    onError: (error) => {
      setPendingStatus(null);
      onError("Changement de statut impossible")(error);
    },
  });

  const noteMutation = useMutation({
    mutationFn: (value: string) => saveOrderNote(id, value),
    onSuccess: (order) => {
      applyOrder(order);
      setNote(null);
      showToast({ title: "Note enregistrée", tone: "success" });
    },
    onError: onError("Note non enregistrée"),
  });

  const blacklistMutation = useMutation({
    mutationFn: (value: string) => blacklistOrderPhone(id, value),
    onSuccess: (order) => {
      applyOrder(order);
      setBlacklistOpen(false);
      setReason("");
      showToast({ title: "Numéro ajouté à la liste noire" });
    },
    onError: onError("Ajout impossible"),
  });

  if (query.isPending)
    return <p className="py-10 text-center text-sm text-stone">Chargement de la commande…</p>;
  if (query.isError) {
    return (
      <div className="py-10 text-center">
        <p role="alert" className="text-sm text-error">
          {query.error instanceof ApiError
            ? query.error.message
            : "Impossible de charger la commande."}
        </p>
        <Link
          href={adminRoutes.orders}
          className="mt-4 inline-block text-sm underline underline-offset-4"
        >
          Retour aux commandes
        </Link>
      </div>
    );
  }

  const { order, product } = query.data;
  const wilaya = getWilaya(order.wilayaCode);
  const transitions = ORDER_STATUS_TRANSITIONS[order.status];
  const editable = EDITABLE_STATUSES.includes(order.status);
  const noteValue = note ?? order.adminNote;

  return (
    <div className="pb-20 lg:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[2rem] leading-none font-medium uppercase lg:text-[2.4rem]">
            {order.fullName}
          </h1>
          <p className="mt-2 text-sm text-ash">
            {order.orderNumber} · reçue le {formatDateTime(order.createdAt)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-3">
        <OrderFlags order={order} withReasons />
      </div>

      {/* Call / WhatsApp: fixed above the bottom navigation on a phone. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 grid grid-cols-2 gap-px border-t border-line bg-line lg:static lg:mt-6 lg:max-w-md lg:gap-2 lg:border-0 lg:bg-transparent">
        <a href={telLink(order.phone)} className={cn(bigButton, "bg-ink text-paper")}>
          <PhoneIcon width={20} height={20} /> Appeler
        </a>
        <a
          href={customerWhatsAppLink(order)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(bigButton, "bg-paper text-ink lg:border lg:border-ink")}
        >
          <WhatsAppIcon width={20} height={20} /> WhatsApp
        </a>
      </div>

      {/* Status actions */}
      {transitions.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {transitions.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setPendingStatus(status)}
              className={cn(
                "flex h-12 items-center justify-center px-5 text-[11px] font-semibold tracking-button uppercase",
                DANGER.includes(status)
                  ? "border border-error text-error hover:bg-error hover:text-paper"
                  : "bg-ink text-paper hover:bg-graphite",
                transitions.length === 1 && "col-span-2",
              )}
            >
              {ORDER_STATUS_ACTION_LABELS[status]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Section
          title="Produit et prix"
          action={
            editable && product ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex min-h-10 items-center gap-1.5 text-sm underline underline-offset-4"
              >
                <EditIcon width={16} height={16} /> Modifier
              </button>
            ) : undefined
          }
        >
          <div className="flex gap-4">
            <div className="relative size-20 shrink-0 bg-cream">
              <Image src={order.item.image} alt="" fill sizes="80px" className="object-contain" />
            </div>
            <div className="text-sm">
              <p className="font-semibold tracking-[0.06em] uppercase">{order.item.name}</p>
              <p className="mt-1 text-ash">
                {order.item.color} · Taille {order.item.size} · Quantité {order.item.quantity}
              </p>
            </div>
          </div>
          <dl className="mt-4 text-sm">
            <Row label={`Articles (${order.item.quantity} × ${formatPrice(order.item.unitPrice)})`}>
              {formatPrice(order.subtotal)}
            </Row>
            <Row label={`Livraison ${deliveryLabel(order).toLowerCase()}`}>
              {formatPrice(order.deliveryFeeBase)}
            </Row>
            {order.deliveryDiscount > 0 && (
              <Row label={order.freeDelivery ? "Livraison gratuite" : "Réduction livraison"}>
                {formatDiscount(order.deliveryDiscount)}
              </Row>
            )}
            <Row label="Total à encaisser" strong>
              {formatPrice(order.total)}
            </Row>
          </dl>
        </Section>

        <Section title="Client et livraison">
          <dl className="text-sm">
            <Row label="Nom">{order.fullName}</Row>
            <Row label="Téléphone">
              <a href={telLink(order.phone)} className="underline underline-offset-4">
                {formatPhone(order.phone)}
              </a>
            </Row>
            <Row label="Wilaya">{wilaya ? formatWilaya(wilaya) : order.wilayaCode}</Row>
            <Row label="Commune">{order.commune}</Row>
            <Row label="Mode">{deliveryLabel(order)}</Row>
            {order.deliveryType === "home" && <Row label="Adresse">{order.address}</Row>}
          </dl>
        </Section>

        <Section title="Note interne">
          <label htmlFor="order-note" className="sr-only">
            Note interne
          </label>
          <textarea
            id="order-note"
            rows={3}
            value={noteValue}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex. : client rappelle ce soir"
            maxLength={2000}
            className="w-full border border-ink/25 bg-bone/60 p-3 text-[15px] focus:border-ink focus:outline-none"
          />
          {note !== null && note !== order.adminNote && (
            <button
              type="button"
              disabled={noteMutation.isPending}
              onClick={() => noteMutation.mutate(note)}
              className="mt-2 h-11 w-full bg-ink text-[11px] font-semibold tracking-button text-paper uppercase disabled:opacity-60 sm:w-auto sm:px-5"
            >
              {noteMutation.isPending ? "Enregistrement…" : "Enregistrer la note"}
            </button>
          )}
        </Section>

        <Section title="Informations internes">
          <dl className="text-sm">
            <Row label="N° de commande">{order.orderNumber}</Row>
            <Row label="Adresse IP">{order.ip ?? "—"}</Row>
            <Row label="Stock">
              {order.stockReserved ? "Articles réservés" : "Articles remis en stock"}
            </Row>
            <Row label="Meta (serveur)">
              {
                { sent: "Envoyé", failed: "Échec", skipped: "Désactivé", pending: "En attente" }[
                  order.metaPurchaseStatus
                ]
              }
            </Row>
          </dl>
          {order.userAgent && (
            <p className="mt-2 text-xs wrap-break-word text-stone">{order.userAgent}</p>
          )}
          {!order.blacklist && (
            <button
              type="button"
              onClick={() => setBlacklistOpen(true)}
              className="mt-4 flex min-h-11 items-center gap-2 text-sm text-error underline underline-offset-4"
            >
              <BanIcon width={18} height={18} /> Ajouter à la liste noire
            </button>
          )}
        </Section>
      </div>

      <section className="mt-4 border border-line bg-paper p-4 sm:p-5">
        <h2 className="text-[11px] font-semibold tracking-label text-stone uppercase">
          Historique
        </h2>
        <ol className="mt-3 space-y-3 border-l border-line pl-4">
          {[...order.history].reverse().map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="relative text-sm">
              <span
                className="absolute top-1.5 -left-5.25 size-2.5 rounded-full border border-ink bg-paper"
                aria-hidden="true"
              />
              <p>{entry.message}</p>
              <p className="mt-0.5 text-xs text-stone">
                {formatDateTime(entry.at)}
                {entry.by ? ` · ${entry.by}` : " · client"}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <AdminDialog
        open={pendingStatus !== null}
        onClose={() => setPendingStatus(null)}
        title={pendingStatus ? `${ORDER_STATUS_ACTION_LABELS[pendingStatus]} ?` : ""}
      >
        {pendingStatus && (
          <>
            <p className="text-[15px] leading-relaxed text-ash">{STATUS_CONFIRM[pendingStatus]}</p>
            <p className="mt-3 text-sm">
              {order.item.name} · {order.item.color} · {order.item.size} · ×{order.item.quantity} ·{" "}
              <strong>{formatPrice(order.total)}</strong>
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={statusMutation.isPending}
                onClick={() => once(() => statusMutation.mutateAsync(pendingStatus))}
                className={cn(
                  "h-12 text-[11px] font-semibold tracking-button text-paper uppercase disabled:opacity-60",
                  DANGER.includes(pendingStatus) ? "bg-error" : "bg-ink",
                )}
              >
                {statusMutation.isPending ? "En cours…" : ORDER_STATUS_ACTION_LABELS[pendingStatus]}
              </button>
              <button
                type="button"
                onClick={() => setPendingStatus(null)}
                className="h-12 border border-ink text-[11px] font-semibold tracking-button uppercase"
              >
                Retour
              </button>
            </div>
          </>
        )}
      </AdminDialog>

      <AdminDialog open={blacklistOpen} onClose={() => setBlacklistOpen(false)} title="Liste noire">
        <p className="text-sm text-ash">
          Les prochaines commandes du {formatPhone(order.phone)} seront enregistrées, mais signalées
          «&nbsp;Liste noire&nbsp;».
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {BLACKLIST_REASONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setReason(suggestion)}
              className={cn(
                "h-10 border px-3 text-[13px]",
                reason === suggestion ? "border-ink bg-ink text-paper" : "border-line bg-paper",
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <label htmlFor="blacklist-reason" className="mt-4 block text-xs text-ash">
          Raison
        </label>
        <input
          id="blacklist-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={200}
          className="mt-1 h-11 w-full border border-ink/25 bg-paper px-3 text-[15px] focus:border-ink focus:outline-none"
        />
        <button
          type="button"
          disabled={reason.trim().length < 3 || blacklistMutation.isPending}
          onClick={() => blacklistMutation.mutate(reason.trim())}
          className="mt-5 h-12 w-full bg-error text-[11px] font-semibold tracking-button text-paper uppercase disabled:opacity-50"
        >
          Ajouter à la liste noire
        </button>
      </AdminDialog>

      {product && editOpen && (
        <OrderEditDialog
          order={order}
          product={product}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            applyOrder(updated);
            setEditOpen(false);
            showToast({
              title: "Commande modifiée",
              message: `Nouveau total : ${formatPrice(updated.total)}`,
              tone: "success",
            });
            void queryClient.invalidateQueries({ queryKey: ["admin", "order", id] });
          }}
        />
      )}
    </div>
  );
}
