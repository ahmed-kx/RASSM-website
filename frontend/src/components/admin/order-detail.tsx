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
import { useState } from "react";
import {
  BanIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EditIcon,
  MapPinIcon,
  MoreIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/ui/icons";
import {
  customerWhatsAppLink,
  deliveryLabel,
  describeUserAgent,
  formatDateTime,
  formatPhone,
  formatReceivedAt,
  telLink,
} from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  blacklistOrderPhone,
  changeOrderStatus,
  exportForAnderson,
  fetchAdminOrder,
  saveOrderNote,
  setOrderTest,
} from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { AdminMenu } from "./admin-top-bar";
import {
  AdminCard,
  AdminEmpty,
  InfoRow,
  InitialAvatar,
  adminField,
  adminInput,
  adminLabel,
  buttonClass,
} from "./admin-ui";
import { OrderFlags, StatusBadge } from "./badges";
import { OrderEditDialog } from "./order-edit-dialog";
import { useToast } from "./toasts";
import { useSingleFlight } from "./use-single-flight";

/** What the confirmation dialog says before each status change. */
const STATUS_CONFIRM: Record<OrderStatus, string> = {
  pending: "La commande repasse en « Nouvelle » et les articles sont repris dans le stock.",
  confirmed: "Le client a confirmé par téléphone : la commande pourra être exportée pour Anderson.",
  shipped: "Le colis a été remis à Anderson.",
  delivered: "Le client a reçu et payé son colis.",
  cancelled: "La commande est annulée et les articles reviennent dans le stock.",
  returned: "Le colis est revenu : les articles reviennent dans le stock.",
};

const DANGER: readonly OrderStatus[] = ["cancelled", "returned"];

const BLACKLIST_REASONS = ["Colis refusé", "Injoignable", "Fausse commande"];

/** Title of a history line (its message gives the details). */
const STATUS_HISTORY_TITLE: Record<OrderStatus, string> = {
  pending: "Commande réactivée",
  confirmed: "Commande confirmée",
  shipped: "Commande expédiée",
  delivered: "Commande livrée",
  cancelled: "Commande annulée",
  returned: "Commande retournée",
};

function historyTitle(entry: AdminOrder["history"][number]): string {
  if (entry.type === "created") return "Commande reçue";
  if (entry.type === "edit") return "Commande modifiée";
  if (entry.type === "blacklist") return "Liste noire";
  return entry.status ? STATUS_HISTORY_TITLE[entry.status] : "Statut modifié";
}

const META_STATUS = {
  sent: "Envoyé",
  failed: "Échec",
  skipped: "Désactivé",
  pending: "En attente",
} as const;

/** The Meta ConfirmedOrder event, as the team reads it ("Envoyé à Meta le 23/10/2026 14:05"). */
function confirmedOrderLabel(meta: AdminOrder["metaConfirmed"]) {
  if (!meta) return "Pas encore confirmée";
  const when = meta.at ? ` le ${formatDateTime(meta.at)}` : "";
  switch (meta.status) {
    case "sent":
      return `Envoyé à Meta${when}`;
    case "failed":
      return `Échec${when}${meta.detail ? ` (${meta.detail})` : ""}`;
    case "skipped":
      return `Non envoyé${meta.detail ? ` : ${meta.detail}` : ""}`;
    case "waiting":
      return "En attente de l'expédition (commande suspecte)";
    case "sending":
      return "Envoi en cours…";
  }
}

const menuItem =
  "flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm hover:bg-cream/60 disabled:opacity-50";

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

  const testMutation = useMutation({
    mutationFn: (test: boolean) => setOrderTest(id, test),
    onSuccess: (order) => {
      applyOrder(order);
      showToast({
        title: order.test ? "Marquée comme commande de test" : "Marquage « test » retiré",
        tone: "success",
      });
    },
    onError: onError("Modification impossible"),
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

  const exportMutation = useMutation({
    mutationFn: () => exportForAnderson({ ids: [id] }),
    onSuccess: () =>
      showToast({
        title: "Fichier Anderson téléchargé",
        message: "Marquez la commande expédiée une fois le colis remis.",
      }),
    onError: onError("Export impossible"),
  });

  if (query.isPending) return <AdminEmpty>Chargement de la commande…</AdminEmpty>;
  if (query.isError) {
    return (
      <div className="space-y-4 text-center">
        <AdminEmpty tone="error">
          {query.error instanceof ApiError
            ? query.error.message
            : "Impossible de charger la commande."}
        </AdminEmpty>
        <Link
          href={adminRoutes.orders}
          className="inline-block text-sm underline underline-offset-4"
        >
          Retour aux commandes
        </Link>
      </div>
    );
  }

  const { order, product } = query.data;
  const wilaya = getWilaya(order.wilayaCode);
  const wilayaLabel = wilaya ? formatWilaya(wilaya) : String(order.wilayaCode);
  const transitions = ORDER_STATUS_TRANSITIONS[order.status];
  const editable = EDITABLE_STATUSES.includes(order.status) && product !== null;
  const noteValue = note ?? order.adminNote;
  const noteChanged = note !== null && note !== order.adminNote;

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      showToast({ title: "Numéro copié", message: order.orderNumber });
    } catch {
      showToast({ title: "Copie impossible", message: order.orderNumber, tone: "error" });
    }
  };

  return (
    <div>
      {/* Header: number, date, status and the "⋯" menu */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={adminLabel}>Commande</p>
          <h1 className="mt-1.5 font-display text-[2.3rem] leading-none font-medium lining-nums sm:text-[2.8rem]">
            {order.orderNumber}
          </h1>
          <p className="mt-2 text-sm text-ash">{formatReceivedAt(order.createdAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-1">
          <StatusBadge status={order.status} size="lg" />
          <AdminMenu
            label="Plus d'actions"
            placement="anchored"
            triggerClassName="grid size-10 place-items-center rounded-sm text-ash hover:bg-cream hover:text-ink"
            trigger={<MoreIcon />}
          >
            {(close) => (
              <ul className="py-1">
                {editable && (
                  <li>
                    <button
                      type="button"
                      className={menuItem}
                      onClick={() => {
                        close();
                        setEditOpen(true);
                      }}
                    >
                      <EditIcon width={18} height={18} /> Modifier la commande
                    </button>
                  </li>
                )}
                {order.status === "confirmed" && (
                  <li>
                    <button
                      type="button"
                      className={menuItem}
                      disabled={exportMutation.isPending}
                      onClick={() => {
                        close();
                        void once(() => exportMutation.mutateAsync());
                      }}
                    >
                      <DownloadIcon width={18} height={18} /> Exporter pour Anderson
                    </button>
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    className={menuItem}
                    onClick={() => {
                      close();
                      void copyNumber();
                    }}
                  >
                    <CopyIcon width={18} height={18} /> Copier le numéro de commande
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={menuItem}
                    disabled={testMutation.isPending}
                    onClick={() => {
                      close();
                      testMutation.mutate(!order.test);
                    }}
                  >
                    <CheckIcon width={18} height={18} />{" "}
                    {order.test ? "Retirer le marquage « test »" : "Marquer comme commande de test"}
                  </button>
                </li>
                {!order.blacklist && (
                  <li className="border-t border-line">
                    <button
                      type="button"
                      className={cn(menuItem, "text-error")}
                      onClick={() => {
                        close();
                        setBlacklistOpen(true);
                      }}
                    >
                      <BanIcon width={18} height={18} /> Ajouter à la liste noire
                    </button>
                  </li>
                )}
              </ul>
            )}
          </AdminMenu>
        </div>
      </div>
      <div className="mt-3 empty:hidden">
        <OrderFlags order={order} withReasons showNew={false} />
      </div>

      {/* Actions: call, WhatsApp, then the allowed status changes */}
      <div
        className={cn(
          "mt-6 grid grid-cols-2 gap-2",
          transitions.length === 1 ? "lg:grid-cols-3" : transitions.length > 1 && "lg:grid-cols-4",
          transitions.length === 0 && "lg:max-w-md",
        )}
      >
        <a href={telLink(order.phone)} className={buttonClass("primary", "h-12")}>
          <PhoneIcon width={19} height={19} /> Appeler
        </a>
        <a
          href={customerWhatsAppLink(order)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("outline", "h-12")}
        >
          <WhatsAppIcon width={19} height={19} /> WhatsApp
        </a>
        {transitions.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setPendingStatus(status)}
            className={buttonClass(
              DANGER.includes(status) ? "danger" : "primary",
              cn("h-12", transitions.length === 1 && "col-span-2 lg:col-span-1"),
            )}
          >
            {ORDER_STATUS_ACTION_LABELS[status]}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* Product and price */}
        <AdminCard
          title="Produit et prix"
          action={
            editable ? (
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
          <div className="flex items-center gap-4">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-sm bg-cream">
              <Image src={order.item.image} alt="" fill sizes="96px" className="object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[17px] leading-tight font-semibold">{order.item.name}</p>
              <p className="mt-1 text-sm text-ash">
                {order.item.color} · Taille {order.item.size} · Quantité {order.item.quantity}
              </p>
            </div>
          </div>
          <dl className="mt-5 border-t border-line pt-3">
            <InfoRow
              label={`Articles (${order.item.quantity} × ${formatPrice(order.item.unitPrice)})`}
            >
              {formatPrice(order.subtotal)}
            </InfoRow>
            <InfoRow label={`Livraison ${deliveryLabel(order).toLowerCase()}`}>
              {formatPrice(order.deliveryFeeBase)}
            </InfoRow>
            {order.deliveryDiscount > 0 && (
              <InfoRow label={order.freeDelivery ? "Livraison gratuite" : "Réduction livraison"}>
                {formatDiscount(order.deliveryDiscount)}
              </InfoRow>
            )}
            <InfoRow label="Total à encaisser" strong>
              {formatPrice(order.total)}
            </InfoRow>
          </dl>
        </AdminCard>

        <div className="grid content-start gap-4">
          {/* Customer */}
          <AdminCard title="Client">
            <div className="flex items-center gap-3">
              <InitialAvatar name={order.fullName} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{order.fullName}</p>
                <a
                  href={telLink(order.phone)}
                  className="text-sm text-ash tabular-nums underline-offset-4 hover:underline"
                >
                  {formatPhone(order.phone)}
                </a>
              </div>
            </div>
            <dl className="mt-4 border-t border-line pt-2">
              <InfoRow label="Wilaya">{wilayaLabel}</InfoRow>
              <InfoRow label="Commune">{order.commune}</InfoRow>
              <InfoRow label="Mode de livraison">{deliveryLabel(order)}</InfoRow>
            </dl>
          </AdminCard>

          {/* Delivery address */}
          <AdminCard title="Adresse de livraison">
            <div className="flex gap-3 text-sm">
              <MapPinIcon width={20} height={20} className="mt-0.5 shrink-0 text-ash" />
              <address className="not-italic">
                <p className="font-semibold">{order.fullName}</p>
                <p className="text-ash">
                  {order.deliveryType === "home" ? order.address : "Au bureau Anderson (stop desk)"}
                </p>
                <p className="text-ash">
                  {order.commune}, {wilaya?.name ?? wilayaLabel}
                </p>
                <p className="text-ash">Algérie</p>
              </address>
            </div>
          </AdminCard>
        </div>

        {/* Internal note */}
        <AdminCard title="Note interne">
          <label htmlFor="order-note" className="sr-only">
            Note interne
          </label>
          <textarea
            id="order-note"
            rows={4}
            value={noteValue}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex. : client rappelle ce soir…"
            maxLength={2000}
            className={cn(adminField, "bg-bone/60 py-3")}
          />
          <button
            type="button"
            disabled={!noteChanged || noteMutation.isPending}
            onClick={() => note !== null && noteMutation.mutate(note)}
            className={buttonClass("primary", "mt-3", "plain")}
          >
            {noteMutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </AdminCard>

        {/* Internal information */}
        <AdminCard title="Informations internes">
          <dl>
            <InfoRow label="N° de commande">{order.orderNumber}</InfoRow>
            <InfoRow label="Stock">
              {order.stockReserved ? "Articles réservés" : "Articles remis en stock"}
            </InfoRow>
            <InfoRow label="Prix de revient">
              {order.unitCost === null ? (
                <span className="text-warning">coût manquant</span>
              ) : (
                `${formatPrice(order.unitCost)} × ${order.item.quantity}`
              )}
            </InfoRow>
            {order.costs.packaging !== null && (
              <InfoRow label="Emballage">{formatPrice(order.costs.packaging)}</InfoRow>
            )}
            {order.costs.returnCost !== null && (
              <InfoRow label="Coût du retour">{formatPrice(order.costs.returnCost)}</InfoRow>
            )}
            <InfoRow label="Source">Site web</InfoRow>
            <InfoRow label="Navigateur / User Agent">
              <span title={order.userAgent ?? undefined}>{describeUserAgent(order.userAgent)}</span>
            </InfoRow>
            <InfoRow label="Adresse IP">{order.ip ?? "—"}</InfoRow>
            <InfoRow label="Meta : achat (serveur)">
              {order.metaPurchaseNote
                ? `Non envoyé : ${order.metaPurchaseNote}`
                : META_STATUS[order.metaPurchaseStatus]}
            </InfoRow>
            <InfoRow label="Meta : commande confirmée">
              <span className={order.metaConfirmed?.status === "failed" ? "text-error" : undefined}>
                {confirmedOrderLabel(order.metaConfirmed)}
              </span>
            </InfoRow>
            {order.suspicious && (
              <InfoRow label="Suspecte">
                <span className="text-warning">{order.suspiciousReason ?? "Oui"}</span>
              </InfoRow>
            )}
          </dl>
          {order.blacklist ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-error">
              <BanIcon width={18} height={18} /> Liste noire : {order.blacklist.reason}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setBlacklistOpen(true)}
              className="mt-3 flex min-h-11 items-center gap-2 text-sm text-error underline underline-offset-4"
            >
              <BanIcon width={18} height={18} /> Ajouter à la liste noire
            </button>
          )}
        </AdminCard>
      </div>

      {/* History */}
      <AdminCard title="Historique" className="mt-4">
        <ol>
          {order.history.map((entry, index) => {
            const last = index === order.history.length - 1;
            return (
              <li
                key={`${entry.at}-${index}`}
                className="relative grid grid-cols-[1.25rem_1fr] gap-3"
              >
                <span aria-hidden="true" className="relative flex justify-center">
                  <span
                    className={cn(
                      "relative z-10 mt-1.5 size-2.5 rounded-full",
                      last ? "bg-ink" : "border border-ink bg-paper",
                    )}
                  />
                  {!last && <span className="absolute top-3 bottom-0 w-px bg-line" />}
                </span>
                <div className="grid gap-x-6 gap-y-0.5 pb-4 text-sm sm:grid-cols-[11rem_9rem_1fr]">
                  <p className="font-semibold">{historyTitle(entry)}</p>
                  <p className="text-stone tabular-nums">{formatDateTime(entry.at)}</p>
                  <p className="text-ash">
                    {entry.message}
                    <span className="text-stone"> · {entry.by ?? "client"}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </AdminCard>

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
                className={buttonClass(
                  DANGER.includes(pendingStatus) ? "dangerSolid" : "primary",
                  "h-12",
                )}
              >
                {statusMutation.isPending ? "En cours…" : ORDER_STATUS_ACTION_LABELS[pendingStatus]}
              </button>
              <button
                type="button"
                onClick={() => setPendingStatus(null)}
                className={buttonClass("outline", "h-12")}
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
                "h-10 rounded-sm border px-3 text-[13px]",
                reason === suggestion ? "border-ink bg-ink text-paper" : "border-line bg-paper",
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <label htmlFor="blacklist-reason" className={cn(adminLabel, "mt-4 block")}>
          Raison
        </label>
        <input
          id="blacklist-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={200}
          className={cn(adminInput, "mt-1.5")}
        />
        <button
          type="button"
          disabled={reason.trim().length < 3 || blacklistMutation.isPending}
          onClick={() => blacklistMutation.mutate(reason.trim())}
          className={buttonClass("dangerSolid", "mt-5 h-12 w-full")}
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
