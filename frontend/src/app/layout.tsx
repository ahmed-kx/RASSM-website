import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CartProvider } from "@/components/cart/cart-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getProducts } from "@/lib/data/products";
import { bodyFont, displayFont, handFont } from "@/lib/fonts";
import "./globals.css";

const description =
  "Hoodies, sweatshirts et t-shirts oversize aux imprimés de croquis artistiques. Livraison dans les 58 wilayas, paiement à la livraison.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "RASSM | Draw what you can't say.",
    template: "%s | RASSM",
  },
  description,
  openGraph: {
    type: "website",
    locale: "fr_DZ",
    siteName: "RASSM",
    title: "RASSM | Draw what you can't say.",
    description,
    images: [
      {
        url: "/images/og/og-home.jpg",
        width: 1200,
        height: 630,
        alt: "RASSM, streetwear algérien",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const products = await getProducts();

  return (
    <html lang="fr" className={`${displayFont.variable} ${bodyFont.variable} ${handFont.variable}`}>
      <body>
        <a
          href="#contenu"
          className="sr-only z-50 bg-paper px-4 py-2 text-sm text-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Aller au contenu
        </a>
        <CartProvider products={products}>
          <SiteHeader />
          <main id="contenu">{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
