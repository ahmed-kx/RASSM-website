"use client";

import { formatPrice, type Admin } from "@rassm/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { BellIcon, LogoutIcon, SoundOffIcon, SoundOnIcon } from "@/components/ui/icons";
import { formatRelativeTime, orderProductLine } from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { cn } from "@/lib/cn";
import { adminLogout, fetchAdminOrders } from "@/lib/data/admin";
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
 * A button and its panel. Top bar menus run under the top bar across the screen on phones and
 * drop down on larger screens; "anchored" menus always drop down under their button. Closes on
 * Escape (focus back on the button), a click outside or a page change.
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
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
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

  return (
    <div ref={root} className={placement === "anchored" ? "relative" : "sm:relative"}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={label}
          className={cn(
            "z-40 overflow-hidden rounded-md border border-line bg-paper text-ink shadow-[0_18px_40px_-18px_rgb(17_17_17/0.45)] motion-safe:animate-fade-in",
            placement === "anchored"
              ? "absolute top-full right-0 mt-2 w-64"
              : "fixed inset-x-3 top-15 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
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
    <ul className="max-h-[min(60svh,26rem)] divide-y divide-line overflow-y-auto">
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

export function NotificationBell({ surface }: { surface: Surface }) {
  const { unopened } = useLiveOrders();
  const { dismissAll } = useToast();
  const label =
    unopened > 0
      ? `Notifications : ${unopened} nouvelle${unopened > 1 ? "s" : ""} commande${unopened > 1 ? "s" : ""}`
      : "Notifications";
  return (
    <AdminMenu
      label={label}
      triggerClassName={iconButton(surface)}
      onOpen={dismissAll}
      trigger={
        <>
          <BellIcon />
          {unopened > 0 && (
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
            <p className="text-[11px] font-semibold tracking-label uppercase">
              Nouvelles commandes
            </p>
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
