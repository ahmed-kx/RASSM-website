import type { ReactNode } from "react";
import { MetaPixelPageView } from "@/components/analytics/meta-pixel-page-view";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/** The public site: skip link, header, footer and the Meta Pixel (never on the dashboard). */
export default function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <a
        href="#contenu"
        className="sr-only z-50 bg-paper px-4 py-2 text-sm text-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="contenu">{children}</main>
      <SiteFooter />
      <MetaPixelPageView />
    </>
  );
}
