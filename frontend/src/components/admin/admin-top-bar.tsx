"use client";

import { CONTACT_SUBJECT_LABELS, formatPrice, type Admin } from "@rassm/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { BellIcon, LogoutIcon, SoundOffIcon, SoundOnIcon } from "@/components/ui/icons";
import { formatRelativeTime, orderProductLine } from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { cn } from "@/lib/cn";
import { adminLogout, fetchAdminOrders, fetchMessages } from "@/lib/data/admin";
import { useLiveOrders } from "./live-orders";
import { useToast } from "./toasts";

// Right side of the dashboard top bar: sound, notification bell (latest new orders) and the
// admin avatar (account menu). Dark top bar on phones, light one on computers.

type Surface = "dark" | "light";

const iconButton = (surface: Surface) =>
  cn(
    "relative grid size-11 place-items-center transition-colors",
    surface === "dark" ? "text-mist hover:text-paper" : "text-ash hover:text-ink",
  );

/**
 * A button and its panel. The panel is rendered in a portal on `document.body` (above every
 * table row, card and sticky header, whatever stacking context they create) and positioned
 * with fixed coordinates from the button: under it, or above it near the bottom of the screen,
 * always inside the viewport. Top bar menus run across the screen under the top bar on phones.
 * Closes on Escape (focus back on the button), a click outside or a page change.
 */
export function AdminMenu({
  label,
  trigger,
  triggerClassName,
  onOpen,
  placement = "topbar",
  children,
}: {
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  onOpen?: () => void;
  placement?: "topbar" | "anchored";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Position from the button, again when the page scrolls or resizes (or the content changes).
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = button.current?.getBoundingClientRect();
      const box = panel.current;
      if (!trigger || !box) return;
      const margin = 12;
      const gap = 8;
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      if (placement === "topbar" && viewW < 640) {
        setStyle({ left: margin, right: margin, top: 60, maxHeight: viewH - 60 - margin });
        return;
      }
      const width = Math.min(placement === "anchored" ? 256 : 384, viewW - margin * 2);
      const height = box.offsetHeight;
      const left = Math.min(Math.max(trigger.right - width, margin), viewW - width - margin);
      const below = viewH - trigger.bottom - gap - margin;
      const above = trigger.top - gap - margin;
      const up = height > below && above > below;
      const room = Math.max(up ? above : below, 120);
      const shown = Math.min(height, room);
      setStyle({
        left,
        width,
        maxHeight: room,
        top: up ? trigger.top - gap - shown : trigger.bottom + gap,
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, placement]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open) {
            setStyle({ visibility: "hidden" });
            onOpen?.();
          }
          setOpen(!open);
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="region"
            aria-label={label}
            style={style}
            className="fixed z-[100] overflow-y-auto rounded-md border border-line bg-paper text-ink opacity-100 shadow-[0_18px_40px_-12px_rgb(17_17_17/0.5)]"
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}

export function SoundButton({ surface }: { surface: Surface }) {
  const { muted, toggleMuted } = useLiveOrders();
  const Icon = muted ? SoundOffIcon : SoundOnIcon;
  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-pressed={!muted}
      aria-label={
        muted ? "Activer le son des nouvelles commandes" : "Couper le son des nouvelles commandes"
      }
      className={iconButton(surface)}
    >
      <Icon />
    </button>
  );
}

function BrowserNotificationsButton() {
  const { notificationPermission, enableNotifications } = useLiveOrders();
  if (notificationPermission === "unsupported" || notificationPermission === "granted") return null;
  return (
    <button
      type="button"
      disabled={notificationPermission === "denied"}
      onClick={() => void enableNotifications()}
      className="flex min-h-11 w-full items-center gap-3 border-t border-line px-4 text-left text-sm text-ash hover:text-ink disabled:opacity-50"
    >
      <BellIcon width={18} height={18} />
      {notificationPermission === "denied"
        ? "Notifications bloquées par le navigateur"
        : "Activer les notifications du navigateur"}
    </button>
  );
}

/** Pending orders nobody has opened yet, newest first (5 at most). */
function NewOrdersList({ close }: { close: () => void }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "orders", "bell"],
    queryFn: () => fetchAdminOrders({ status: "pending", limit: 20 }),
  });
  const orders = (data?.orders ?? []).filter((order) => order.openedAt === null).slice(0, 5);

  if (isPending) return <p className="px-4 py-5 text-sm text-stone">Chargement…</p>;
  if (isError) {
    return <p className="px-4 py-5 text-sm text-error">Impossible de charger les commandes.</p>;
  }
  if (orders.length === 0) {
    return <p className="px-4 py-5 text-sm text-stone">Aucune nouvelle commande.</p>;
  }
  return (
    <ul className="max-h-[min(36svh,18rem)] divide-y divide-line overflow-y-auto">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={adminRoutes.order(order.id)}
            onClick={close}
            className="block px-4 py-3 hover:bg-cream/60 focus-visible:bg-cream/60"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate font-semibold">{order.fullName}</span>
              <span className="shrink-0 text-sm tabular-nums">{formatPrice(order.total)}</span>
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-ash">
              {orderProductLine(order)}
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-xs text-stone">
              {formatRelativeTime(order.createdAt)}
              {order.blacklist && <span className="font-semibold text-error">Liste noire</span>}
              {order.suspicious && <span className="font-semibold text-warning">Suspecte</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Unread contact messages, newest first (3 at most). */
function UnreadMessagesList({ close }: { close: () => void }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "messages", "bell"],
    queryFn: () => fetchMessages({ folder: "unread", limit: 3 }),
  });
  if (isPending) return <p className="px-4 py-4 text-sm text-stone">Chargement…</p>;
  if (isError) {
    return <p className="px-4 py-4 text-sm text-error">Impossible de charger les messages.</p>;
  }
  if (data.messages.length === 0) {
    return <p className="px-4 py-4 text-sm text-stone">Aucun message non lu.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {data.messages.map((message) => (
        <li key={message.id}>
          <Link
            href={adminRoutes.message(message.id)}
            onClick={close}
            className="block px-4 py-3 hover:bg-cream/60 focus-visible:bg-cream/60"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate font-semibold">
                {message.firstName} {message.lastName}
              </span>
              <span className="shrink-0 text-xs text-stone">
                {CONTACT_SUBJECT_LABELS[message.subject]}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-ash">{message.message}</span>
            <span className="mt-0.5 block text-xs text-stone">
              {formatRelativeTime(message.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const sectionTitle = "text-[11px] font-semibold tracking-label uppercase";

export function NotificationBell({ surface }: { surface: Surface }) {
  const { unopened, unreadMessages } = useLiveOrders();
  const { dismissAll } = useToast();
  const parts = [
    unopened > 0 &&
      `${unopened} nouvelle${unopened > 1 ? "s" : ""} commande${unopened > 1 ? "s" : ""}`,
    unreadMessages > 0 &&
      `${unreadMessages} message${unreadMessages > 1 ? "s" : ""} non lu${unreadMessages > 1 ? "s" : ""}`,
  ].filter(Boolean);
  const label = parts.length ? `Notifications : ${parts.join(", ")}` : "Notifications";
  return (
    <AdminMenu
      label={label}
      triggerClassName={iconButton(surface)}
      onOpen={dismissAll}
      trigger={
        <>
          <BellIcon />
          {unopened + unreadMessages > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-2.5 right-2.5 size-2.5 rounded-full bg-error ring-2",
                surface === "dark" ? "ring-onyx" : "ring-bone",
              )}
            />
          )}
        </>
      }
    >
      {(close) => (
        <>
          <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
            <p className={sectionTitle}>Nouvelles commandes</p>
            {unopened > 0 && <span className="text-xs text-stone tabular-nums">{unopened}</span>}
          </div>
          <NewOrdersList close={close} />
          <Link
            href={`${adminRoutes.orders}?statut=pending`}
            onClick={close}
            className="flex min-h-11 items-center justify-center border-t border-line px-4 text-[11px] font-semibold tracking-label uppercase hover:bg-cream/60"
          >
            Voir les nouvelles commandes →
          </Link>
          <div className="flex items-baseline justify-between gap-3 border-y border-line bg-bone/60 px-4 py-3">
            <p className={sectionTitle}>Messages non lus</p>
            {unreadMessages > 0 && (
              <span className="text-xs text-stone tabular-nums">{unreadMessages}</span>
            )}
          </div>
          <UnreadMessagesList close={close} />
          <Link
            href={`${adminRoutes.messages}?dossier=unread`}
            onClick={close}
            className="flex min-h-11 items-center justify-center border-t border-line px-4 text-[11px] font-semibold tracking-label uppercase hover:bg-cream/60"
          >
            Voir les messages →
          </Link>
          <BrowserNotificationsButton />
        </>
      )}
    </AdminMenu>
  );
}

export function AccountMenu({ admin, surface }: { admin: Admin; surface: Surface }) {
  const router = useRouter();
  const logout = async () => {
    await adminLogout();
    router.replace(adminRoutes.login);
    router.refresh();
  };
  return (
    <AdminMenu
      label="Mon compte"
      triggerClassName="grid size-11 place-items-center"
      trigger={
        <span
          aria-hidden="true"
          className={cn(
            "grid size-8 place-items-center rounded-full text-sm font-semibold uppercase",
            surface === "dark" ? "bg-paper text-ink" : "bg-ink text-paper",
          )}
        >
          {admin.email.charAt(0)}
        </span>
      }
    >
      {() => (
        <>
          <div className="border-b border-line px-4 py-3">
            <p className="text-xs text-stone">Connecté en tant que</p>
            <p className="truncate text-sm font-semibold" title={admin.email}>
              {admin.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex min-h-12 w-full items-center gap-3 px-4 text-sm hover:bg-cream/60"
          >
            <LogoutIcon width={18} height={18} />
            Déconnexion
          </button>
        </>
      )}
    </AdminMenu>
  );
}
