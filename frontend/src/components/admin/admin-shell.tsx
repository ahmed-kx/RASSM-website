"use client";

import type { Admin } from "@rassm/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import {
  BanIcon,
  BellIcon,
  DashboardIcon,
  LogoutIcon,
  MailIcon,
  MoreIcon,
  OrdersIcon,
  ShirtIcon,
  SoundOffIcon,
  SoundOnIcon,
  TruckIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { adminRoutes } from "@/lib/admin/routes";
import { cn } from "@/lib/cn";
import { adminLogout, setUnauthorizedHandler } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { LiveOrdersProvider, useLiveOrders } from "./live-orders";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  label: string;
  href: string;
  Icon: Icon;
  /** Shown in the phone's bottom bar (the others are under "Plus"). */
  primary?: boolean;
}

const NAV: readonly NavItem[] = [
  { label: "Tableau de bord", href: adminRoutes.home, Icon: DashboardIcon, primary: true },
  { label: "Commandes", href: adminRoutes.orders, Icon: OrdersIcon, primary: true },
  { label: "Produits", href: adminRoutes.products, Icon: ShirtIcon, primary: true },
  { label: "Livraison", href: adminRoutes.delivery, Icon: TruckIcon },
  { label: "Messages", href: adminRoutes.messages, Icon: MailIcon },
  { label: "Abonnés", href: adminRoutes.subscribers, Icon: UsersIcon },
  { label: "Liste noire", href: adminRoutes.blacklist, Icon: BanIcon },
];

function isActive(pathname: string, href: string) {
  return href === adminRoutes.home ? pathname === href : pathname.startsWith(href);
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} nouvelle${count > 1 ? "s" : ""}`}
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-full bg-error px-1.5 text-[11px] leading-none font-semibold text-paper tabular-nums",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function useLogout() {
  const router = useRouter();
  return async () => {
    await adminLogout();
    router.replace(adminRoutes.login);
    router.refresh();
  };
}

function SoundButton({ className }: { className?: string }) {
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
      className={cn("grid size-11 place-items-center hover:opacity-70", className)}
    >
      <Icon />
    </button>
  );
}

function NotificationsButton({ onDone }: { onDone?: () => void }) {
  const { notificationPermission, enableNotifications } = useLiveOrders();
  if (notificationPermission === "unsupported" || notificationPermission === "granted") return null;
  return (
    <button
      type="button"
      disabled={notificationPermission === "denied"}
      onClick={() => void enableNotifications().then(onDone)}
      className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm disabled:opacity-50"
    >
      <BellIcon />
      {notificationPermission === "denied"
        ? "Notifications bloquées par le navigateur"
        : "Activer les notifications du navigateur"}
    </button>
  );
}

function Sidebar({ admin }: { admin: Admin }) {
  const pathname = usePathname();
  const { unopened } = useLiveOrders();
  const logout = useLogout();
  return (
    <aside className="sticky top-0 hidden h-svh flex-col bg-onyx text-paper lg:flex">
      <div className="flex items-center justify-between px-6 pt-7 pb-6">
        <Link
          href={adminRoutes.home}
          className="font-display text-[1.75rem] leading-none tracking-[0.12em]"
        >
          RASSM
          <span className="mt-1 block font-serif text-[10px] font-semibold tracking-wide-label text-mist uppercase">
            Admin
          </span>
        </Link>
        <SoundButton className="-mr-2 text-mist hover:text-paper" />
      </div>
      <nav aria-label="Navigation du tableau de bord" className="flex-1 px-3">
        <ul className="space-y-0.5">
          {NAV.map(({ label, href, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 px-3 text-sm transition-colors",
                    active
                      ? "bg-paper/10 text-paper"
                      : "text-mist hover:bg-paper/5 hover:text-paper",
                  )}
                >
                  <Icon width={20} height={20} />
                  <span className="flex-1">{label}</span>
                  {href === adminRoutes.orders && <CountBadge count={unopened} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-paper/10 px-3 py-4 text-mist">
        <NotificationsButton />
        <p className="truncate px-3 pt-2 text-xs" title={admin.email}>
          {admin.email}
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-1 flex min-h-11 w-full items-center gap-3 px-3 text-sm hover:text-paper"
        >
          <LogoutIcon width={20} height={20} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

function MobileBars({ admin }: { admin: Admin }) {
  const pathname = usePathname();
  const { unopened } = useLiveOrders();
  const logout = useLogout();
  const [moreOpen, setMoreOpen] = useState(false);
  const secondary = NAV.filter((item) => !item.primary);
  const moreActive = secondary.some((item) => isActive(pathname, item.href));

  const tab =
    "flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-[0.08em] uppercase";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-onyx pr-2 pl-4 text-paper lg:hidden">
        <Link
          href={adminRoutes.home}
          className="font-display text-2xl leading-none tracking-[0.12em]"
        >
          RASSM{" "}
          <span className="font-serif text-[10px] font-semibold tracking-wide-label text-mist">
            ADMIN
          </span>
        </Link>
        <SoundButton />
      </header>

      <nav
        aria-label="Navigation du tableau de bord"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-paper/10 bg-onyx pb-[env(safe-area-inset-bottom)] text-mist lg:hidden"
      >
        <ul className="grid h-16 grid-cols-4">
          {NAV.filter((item) => item.primary).map(({ label, href, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(tab, active && "text-paper")}
                >
                  <span className="relative">
                    <Icon width={22} height={22} />
                    {href === adminRoutes.orders && (
                      <CountBadge count={unopened} className="absolute -top-2 -right-3.5" />
                    )}
                  </span>
                  {label === "Tableau de bord" ? "Accueil" : label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={cn(tab, "w-full", moreActive && "text-paper")}
            >
              <MoreIcon width={22} height={22} />
              Plus
            </button>
          </li>
        </ul>
      </nav>

      <AdminDialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu">
        <ul className="divide-y divide-line border-y border-line">
          {secondary.map(({ label, href, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-13 items-center gap-3 px-1 text-[15px] aria-[current=page]:font-semibold"
              >
                <Icon /> {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-3 text-ash">
          <NotificationsButton onDone={() => setMoreOpen(false)} />
        </div>
        <p className="mt-3 truncate text-xs text-stone">Connecté : {admin.email}</p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 border border-ink text-[11px] font-semibold tracking-button uppercase"
        >
          <LogoutIcon width={18} height={18} /> Déconnexion
        </button>
      </AdminDialog>
    </>
  );
}

/** Dashboard frame: sidebar on computers, top bar + bottom navigation on phones. */
export function AdminShell({ admin, children }: { admin: Admin; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Session expired while the dashboard is open: back to the login page.
    setUnauthorizedHandler(() => {
      router.replace(`${adminRoutes.login}?suivant=${encodeURIComponent(pathname)}`);
    });
    return () => setUnauthorizedHandler(null);
  }, [router, pathname]);

  return (
    <LiveOrdersProvider>
      <div className="min-h-svh bg-bone text-ink lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <Sidebar admin={admin} />
        <div className="min-w-0">
          <MobileBars admin={admin} />
          <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">
            {children}
          </main>
        </div>
      </div>
    </LiveOrdersProvider>
  );
}

/** Page title of the dashboard. */
export function AdminPageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-display text-[2rem] leading-none font-medium uppercase lg:text-[2.6rem]">
        {title}
      </h1>
      {children}
    </div>
  );
}
