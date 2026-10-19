"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { MAIN_NAV } from "@/content/navigation";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";

const iconButton =
  "grid size-10 place-items-center transition-opacity hover:opacity-70 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current";

/** Pages that start with a full-bleed photo: the header floats over it. */
const HEADER_OVER_HERO: readonly string[] = [routes.home, routes.collection, routes.contact];

function isActive(pathname: string, href: string) {
  return href === routes.home ? pathname === href : pathname.startsWith(href);
}

/**
 * Site header. On pages with a photo hero it floats transparent over it; elsewhere it
 * sits on a dark band. Below `lg` the links move into a full-screen menu.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const overHero = HEADER_OVER_HERO.includes(pathname);
  // Shop pages use the narrower page width (design/Collection.png): align the logo with the content.
  const narrow = pathname.startsWith(routes.collection);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <header
      className={cn(
        "z-40 w-full border-b border-paper/20 text-paper",
        overHero ? "absolute inset-x-0 top-0" : "relative bg-ink",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-16 w-full items-center justify-between gap-6 px-4 sm:px-6 lg:h-[72px] lg:px-12",
          narrow ? "max-w-[1320px]" : "max-w-[1440px]",
        )}
      >
        <Logo />

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-10">
            {MAIN_NAV.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "border-b pb-1 text-[11px] font-semibold tracking-button uppercase transition-colors duration-200 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current",
                      active ? "border-paper" : "border-transparent hover:border-paper/50",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link href={routes.search} aria-label="Rechercher" className={iconButton}>
            <SearchIcon />
          </Link>
          <button
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(true)}
            className={cn(iconButton, "lg:hidden")}
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {menuOpen && <MobileMenu pathname={pathname} onClose={closeMenu} />}
    </header>
  );
}

function MobileMenu({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-50 flex flex-col bg-onyx text-paper lg:hidden"
    >
      <div className="flex h-16 items-center justify-between border-b border-paper/20 px-4 sm:px-6">
        <Logo />
        <button
          ref={closeButton}
          type="button"
          aria-label="Fermer le menu"
          onClick={onClose}
          className={iconButton}
        >
          <CloseIcon />
        </button>
      </div>

      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-4 py-10 sm:px-6">
        <ul className="space-y-5">
          {MAIN_NAV.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "font-display text-4xl font-medium uppercase",
                    active && "border-b border-paper pb-1",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-paper/20 px-4 py-6 text-xs text-mist sm:px-6">
        <p lang="en" className="font-semibold tracking-wide-label text-paper uppercase">
          Draw what you can&apos;t say.
        </p>
        <p className="mt-2">Livraison dans les 58 wilayas · Paiement à la livraison</p>
      </div>
    </div>
  );
}
