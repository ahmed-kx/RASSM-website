"use client";

import type { Admin } from "@rassm/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  BanIcon,
  ChevronRightIcon,
  DashboardIcon,
  HomeIcon,
  MailIcon,
  MoreIcon,
  OrdersIcon,
  ShirtIcon,
  TruckIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { adminRoutes } from "@/lib/admin/routes";
import { cn } from "@/lib/cn";
import { setUnauthorizedHandler } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { AccountMenu, NotificationBell, SoundButton } from "./admin-top-bar";
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

function Sidebar() {
  const pathname = usePathname();
  const { unopened } = useLiveOrders();
  return (
    <aside className="sticky top-0 hidden h-svh flex-col bg-onyx text-paper lg:flex">
      <div className="px-6 pt-7 pb-6">
        <Link
          href={adminRoutes.home}
          className="font-display text-[1.75rem] leading-none tracking-[0.12em]"
        >
          RASSM
          <span className="mt-1 block font-serif text-[10px] font-semibold tracking-wide-label text-mist uppercase">
            Admin
          </span>
        </Link>
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
    </aside>
  );
}

function MobileBars({ admin }: { admin: Admin }) {
  const pathname = usePathname();
  const { unopened } = useLiveOrders();
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
        <div className="flex items-center">
          <SoundButton surface="dark" />
          <NotificationBell surface="dark" />
          <AccountMenu admin={admin} surface="dark" />
        </div>
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
      </AdminDialog>
    </>
  );
}

/** Top bar of the content area on computers (on phones it is in MobileBars). */
function DesktopTopBar({ admin }: { admin: Admin }) {
  return (
    <header className="sticky top-0 z-30 hidden h-16 items-center justify-end border-b border-line bg-bone/95 px-6 backdrop-blur-sm lg:flex">
      <SoundButton surface="light" />
      <NotificationBell surface="light" />
      <AccountMenu admin={admin} surface="light" />
    </header>
  );
}

interface Crumb {
  label: string;
  href?: string;
}

function breadcrumbFor(pathname: string): Crumb[] {
  if (pathname === adminRoutes.home) return [{ label: "Tableau de bord" }];
  const section = NAV.find(
    (item) => item.href !== adminRoutes.home && pathname.startsWith(item.href),
  );
  if (!section) return [];
  if (pathname === section.href) return [{ label: section.label }];
  return [
    { label: section.label, href: section.href },
    { label: section.href === adminRoutes.orders ? "Détail de la commande" : "Détail" },
  ];
}

/** Home icon / section / page, under the top bar. */
function AdminBreadcrumb() {
  const crumbs = breadcrumbFor(usePathname());
  const separator = <ChevronRightIcon width={14} height={14} className="shrink-0 text-stone" />;
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4 lg:mb-6">
      <ol className="flex min-w-0 items-center gap-1.5 text-xs text-stone">
        <li className="flex">
          <Link
            href={adminRoutes.home}
            aria-label="Tableau de bord"
            className="-m-1.5 grid size-8 place-items-center hover:text-ink"
          >
            <HomeIcon width={16} height={16} />
          </Link>
        </li>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.label}>
            <li aria-hidden="true" className="flex">
              {separator}
            </li>
            <li className="min-w-0 truncate">
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-ink">
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={index === crumbs.length - 1 ? "page" : undefined}
                  className="text-ink"
                >
                  {crumb.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
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
        <Sidebar />
        <div className="min-w-0">
          <MobileBars admin={admin} />
          <DesktopTopBar admin={admin} />
          <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-28 sm:px-6 lg:px-10 lg:pt-6 lg:pb-12">
            <AdminBreadcrumb />
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
