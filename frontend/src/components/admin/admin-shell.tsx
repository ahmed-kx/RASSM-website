"use client";

import type { Admin } from "@rassm/shared";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  BanIcon,
  CloseIcon,
  DashboardIcon,
  GearIcon,
  HomeIcon,
  MailIcon,
  MegaphoneIcon,
  MenuIcon,
  MoreIcon,
  OrdersIcon,
  ShirtIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { adminRoutes } from "@/lib/admin/routes";
import { cn } from "@/lib/cn";
import { setUnauthorizedHandler } from "@/lib/data/admin";
import { AdminDialog } from "./admin-dialog";
import { GlobalSearchBar, MobileSearchButton } from "./admin-search";
import { AccountMenu, NotificationBell, SoundButton } from "./admin-top-bar";
import { InitialAvatar } from "./admin-ui";
import { LiveOrdersProvider, useLiveOrders } from "./live-orders";

// Dashboard frame (design/admin-products.png): dark sidebar with a concrete texture at the
// bottom and the admin card, light top bar (menu toggle, global search, sound, bell, avatar)
// and the breadcrumb. Phones: dark top bar, the sidebar as a drawer and a bottom navigation.

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
  { label: "Clients", href: adminRoutes.clients, Icon: UserIcon },
  { label: "Livraison", href: adminRoutes.delivery, Icon: TruckIcon },
  { label: "Publicité", href: adminRoutes.ads, Icon: MegaphoneIcon },
  { label: "Messages", href: adminRoutes.messages, Icon: MailIcon },
  { label: "Abonnés", href: adminRoutes.subscribers, Icon: UsersIcon },
  { label: "Liste noire", href: adminRoutes.blacklist, Icon: BanIcon },
  { label: "Paramètres", href: adminRoutes.settings, Icon: GearIcon },
];

const COLLAPSED_KEY = "rassm-admin-sidebar-collapsed";

function isActive(pathname: string, href: string) {
  return href === adminRoutes.home ? pathname === href : pathname.startsWith(href);
}

const BADGE_STYLES = {
  /** Sidebar (design): beige round counter. */
  sidebar: "h-6 min-w-6 bg-sand text-xs text-ink",
  /** Collapsed sidebar: small, on the icon. */
  dot: "absolute top-1 right-1 h-4 min-w-4 bg-sand text-[10px] text-ink",
  /** Phone bottom bar: red, on the icon. */
  tab: "absolute -top-2 -right-3.5 h-5 min-w-5 bg-error text-[11px] text-paper",
} as const;

function CountBadge({
  count,
  style,
  word = "nouvelle",
}: {
  count: number;
  style: keyof typeof BADGE_STYLES;
  /** "nouvelle" (orders), "non lu" (messages). */
  word?: string;
}) {
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} ${word}${count > 1 ? "s" : ""}`}
      className={cn(
        "grid place-items-center rounded-full px-1.5 leading-none font-semibold tabular-nums",
        BADGE_STYLES[style],
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Logo, menu and admin card: the computer sidebar and the phone drawer. */
function SidebarContent({
  admin,
  collapsed = false,
  onNavigate,
}: {
  admin: Admin;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { unopened, unreadMessages } = useLiveOrders();
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-onyx text-paper">
      {/* Concrete texture fading into the black, behind the admin card. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-80">
        <Image
          src="/images/about/about-values.jpg"
          alt=""
          fill
          sizes="300px"
          className="object-cover object-[70%_center] opacity-35 grayscale"
        />
        <div className="absolute inset-0 bg-linear-to-b from-onyx via-onyx/70 to-onyx/30" />
      </div>

      <Link
        href={adminRoutes.home}
        onClick={onNavigate}
        aria-label="RASSM Admin, tableau de bord"
        className={cn("relative block pt-8 pb-9", collapsed ? "px-0 text-center" : "px-7")}
      >
        <span className="block font-display text-[2.1rem] leading-none tracking-[0.16em]">
          {collapsed ? "R" : "RASSM"}
        </span>
        {!collapsed && (
          <span className="mt-2.5 block pl-0.5 text-[10px] font-semibold tracking-wide-label text-mist uppercase">
            Admin
          </span>
        )}
      </Link>

      <nav aria-label="Navigation du tableau de bord" className="relative flex-1 px-3">
        <ul className="space-y-1">
          {NAV.map(({ label, href, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "relative flex h-12 items-center gap-3.5 rounded-md text-[15px] transition-colors",
                    collapsed ? "justify-center px-0" : "px-4",
                    active
                      ? "bg-paper/8 text-paper ring-1 ring-paper/12"
                      : "text-mist hover:bg-paper/5 hover:text-paper",
                  )}
                >
                  <Icon width={21} height={21} className="shrink-0" />
                  {collapsed ? (
                    <span className="sr-only">{label}</span>
                  ) : (
                    <span className="flex-1">{label}</span>
                  )}
                  {href === adminRoutes.orders && (
                    <CountBadge count={unopened} style={collapsed ? "dot" : "sidebar"} />
                  )}
                  {href === adminRoutes.messages && (
                    <CountBadge
                      count={unreadMessages}
                      style={collapsed ? "dot" : "sidebar"}
                      word="non lu"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="relative p-3 pb-5">
        <div
          className={cn(
            "flex items-center gap-3 rounded-md bg-onyx/70 ring-1 ring-paper/12 backdrop-blur-sm",
            collapsed ? "justify-center p-2" : "p-3",
          )}
          title={collapsed ? admin.email : undefined}
        >
          <InitialAvatar name={admin.email} tone="inverse" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm" title={admin.email}>
                {admin.email}
              </p>
              <p className="text-xs text-mist">Administrateur</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Phones and tablets: the sidebar slides in from the left (native dialog: Escape, focus). */
function SidebarDrawer({
  admin,
  open,
  onClose,
}: {
  admin: Admin;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label="Menu du tableau de bord"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 h-svh max-h-none w-[min(86vw,300px)] max-w-none bg-onyx p-0 backdrop:bg-ink/60 motion-safe:animate-slide-in-left lg:hidden"
    >
      {open && (
        <div className="relative h-full">
          <SidebarContent admin={admin} onNavigate={onClose} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="absolute top-5 right-3 grid size-11 place-items-center text-mist hover:text-paper"
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </dialog>
  );
}

const lightIcon = "grid size-11 place-items-center text-ash transition-colors hover:text-ink";
const darkIcon = "grid size-10 place-items-center text-mist transition-colors hover:text-paper";

/** Computers: light top bar of the content area. */
function DesktopTopBar({
  admin,
  collapsed,
  onToggle,
}: {
  admin: Admin;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-line bg-bone/95 px-6 backdrop-blur-sm lg:flex">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={!collapsed}
        aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
        className={cn(lightIcon, "-ml-2.5")}
      >
        <MenuIcon />
      </button>
      <GlobalSearchBar />
      <div className="ml-auto flex items-center">
        <SoundButton surface="light" />
        <NotificationBell surface="light" />
        <AccountMenu admin={admin} surface="light" />
      </div>
    </header>
  );
}

/** Phones: dark top bar (menu, logo, search, sound, bell, avatar) and bottom navigation. */
function MobileBars({ admin, onOpenMenu }: { admin: Admin; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { unopened, unreadMessages } = useLiveOrders();
  const [moreOpen, setMoreOpen] = useState(false);
  const secondary = NAV.filter((item) => !item.primary);
  const moreActive = secondary.some((item) => isActive(pathname, item.href));

  const tab =
    "flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-[0.08em] uppercase";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center bg-onyx pr-1 pl-1 text-paper lg:hidden">
        <button type="button" onClick={onOpenMenu} aria-label="Ouvrir le menu" className={darkIcon}>
          <MenuIcon />
        </button>
        <Link
          href={adminRoutes.home}
          className="ml-1 font-display text-[1.45rem] leading-none tracking-[0.14em]"
        >
          RASSM
          <span className="sr-only"> Admin</span>
        </Link>
        <div className="ml-auto flex items-center">
          <MobileSearchButton className={darkIcon} />
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
                    {href === adminRoutes.orders && <CountBadge count={unopened} style="tab" />}
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
              <span className="relative">
                <MoreIcon width={22} height={22} />
                <CountBadge count={unreadMessages} style="tab" word="message non lu" />
              </span>
              Plus
            </button>
          </li>
        </ul>
      </nav>

      <AdminDialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu">
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-paper">
          {secondary.map(({ label, href, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-13 items-center gap-3 px-4 text-[15px] aria-[current=page]:font-semibold"
              >
                <Icon /> <span className="flex-1">{label}</span>
                {href === adminRoutes.messages && (
                  <CountBadge count={unreadMessages} style="sidebar" word="non lu" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </AdminDialog>
    </>
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
  const detail =
    section.href === adminRoutes.orders
      ? "Détail de la commande"
      : section.href === adminRoutes.products
        ? pathname === adminRoutes.newProduct
          ? "Nouveau produit"
          : "Modifier le produit"
        : section.href === adminRoutes.clients
          ? "Fiche client"
          : section.href === adminRoutes.messages
            ? "Message"
            : "Détail";
  return [{ label: section.label, href: section.href }, { label: detail }];
}

/** Home icon / section / page, under the top bar. */
function AdminBreadcrumb() {
  const crumbs = breadcrumbFor(usePathname());
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4 lg:mb-5">
      <ol className="flex min-w-0 items-center gap-3 text-sm text-stone">
        <li className="flex">
          <Link
            href={adminRoutes.home}
            aria-label="Tableau de bord"
            className="-m-1.5 grid size-8 place-items-center hover:text-ink"
          >
            <HomeIcon width={18} height={18} />
          </Link>
        </li>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.label}>
            <li aria-hidden="true">/</li>
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

/** Dashboard frame: sidebar on computers, drawer + top bar + bottom navigation on phones. */
export function AdminShell({ admin, children }: { admin: Admin; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // Session expired while the dashboard is open: back to the login page.
    setUnauthorizedHandler(() => {
      router.replace(`${adminRoutes.login}?suivant=${encodeURIComponent(pathname)}`);
    });
    return () => setUnauthorizedHandler(null);
  }, [router, pathname]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Storage blocked: the sidebar stays open.
    }
  }, []);

  useEffect(() => setDrawerOpen(false), [pathname]);

  const toggleCollapsed = () =>
    setCollapsed((current) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, current ? "0" : "1");
      } catch {
        // Storage blocked: the choice lasts for this visit.
      }
      return !current;
    });

  return (
    <LiveOrdersProvider>
      <div
        className={cn(
          "min-h-svh bg-bone text-ink lg:grid",
          collapsed ? "lg:grid-cols-[84px_minmax(0,1fr)]" : "lg:grid-cols-[272px_minmax(0,1fr)]",
        )}
      >
        <aside className="sticky top-0 hidden h-svh lg:block">
          <SidebarContent admin={admin} collapsed={collapsed} />
        </aside>
        <SidebarDrawer admin={admin} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="min-w-0">
          <MobileBars admin={admin} onOpenMenu={() => setDrawerOpen(true)} />
          <DesktopTopBar admin={admin} collapsed={collapsed} onToggle={toggleCollapsed} />
          <main className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-28 sm:px-6 lg:px-11 lg:pt-6 lg:pb-14">
            <AdminBreadcrumb />
            {children}
          </main>
        </div>
      </div>
    </LiveOrdersProvider>
  );
}
