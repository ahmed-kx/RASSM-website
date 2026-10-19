import type { Metadata } from "next";
import type { ReactNode } from "react";
import { bodyFont, displayFont, handFont } from "@/lib/fonts";
import "./globals.css";

const description =
  "Hoodies, sweatshirts et t-shirts oversize aux imprimés de croquis artistiques. Livraison dans les 58 wilayas, paiement à la livraison.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "RASSM | Dessiner ce qu'on ne peut pas dire.",
    template: "%s | RASSM",
  },
  description,
  openGraph: {
    type: "website",
    locale: "fr_DZ",
    siteName: "RASSM",
    title: "RASSM | Dessiner ce qu'on ne peut pas dire.",
    description,
    images: [
      {
        url: "/images/og/og-home.jpg",
        width: 1200,
        height: 630,
        alt: "RASSM, mode urbaine algérienne",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

/**
 * Root layout: fonts and default SEO only. The public site (header, footer, Meta Pixel)
 * lives in app/(site)/layout.tsx; the dashboard in app/admin/ has its own layout.
 */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" className={`${displayFont.variable} ${bodyFont.variable} ${handFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
