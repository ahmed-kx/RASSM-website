import { CONTACT } from "@/content/contact";
import { routes } from "@/lib/routes";

export interface NavLink {
  label: string;
  href: string;
}

export const MAIN_NAV: readonly NavLink[] = [
  { label: "Accueil", href: routes.home },
  { label: "Collection", href: routes.collection },
  { label: "Lookbook", href: routes.lookbook },
  { label: "À propos", href: routes.about },
  { label: "Contact", href: routes.contact },
];

export const FOOTER_COLUMNS: readonly { title: string; links: readonly NavLink[] }[] = [
  {
    title: "Boutique",
    links: [
      { label: "Tous les produits", href: routes.collection },
      { label: "Hoodies", href: routes.category("hoodie") },
      { label: "Sweatshirts", href: routes.category("sweatshirt") },
      { label: "T-shirts", href: routes.category("tshirt") },
    ],
  },
  {
    title: "RASSM",
    links: [
      { label: "À propos", href: routes.about },
      { label: "Lookbook", href: routes.lookbook },
      { label: "Contact", href: routes.contact },
      { label: "FAQ", href: routes.faq },
    ],
  },
  {
    title: "Service client",
    links: [
      { label: "Livraison", href: routes.delivery },
      { label: "Échanges", href: routes.exchanges },
      { label: "Guide des tailles", href: routes.sizeGuide },
      { label: "Nous contacter", href: routes.contact },
    ],
  },
];

export type SocialNetwork = "whatsapp" | "instagram" | "tiktok";

export const SOCIAL_LINKS: readonly { network: SocialNetwork; label: string; href: string }[] = [
  {
    network: "whatsapp",
    label: `Écrire à RASSM sur WhatsApp (${CONTACT.whatsapp.display})`,
    href: CONTACT.whatsapp.href,
  },
  { network: "instagram", label: "RASSM sur Instagram", href: CONTACT.instagram.href },
  { network: "tiktok", label: "RASSM sur TikTok", href: CONTACT.tiktok.href },
];
