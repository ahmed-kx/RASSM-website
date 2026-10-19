import { WILAYA_COUNT } from "@rassm/shared";
import { CONTACT } from "@/content/contact";
import { routes } from "@/lib/routes";

/** A piece of an answer: plain text, or a link (internal route, web URL or tel:). */
export type FaqAnswerPart = string | { label: string; href: string };

export interface FaqItem {
  question: string;
  answer: readonly FaqAnswerPart[];
}

export interface FaqGroup {
  id: string;
  title: string;
  items: readonly FaqItem[];
}

const whatsapp: FaqAnswerPart = {
  label: `WhatsApp (${CONTACT.whatsapp.display})`,
  href: CONTACT.whatsapp.href,
};

export const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    id: "commande",
    title: "Commande",
    items: [
      {
        question: "Comment passer commande ?",
        answer: [
          "Directement sur la page du produit, sans créer de compte : choisissez la couleur, la taille et la quantité, puis remplissez le formulaire (nom, numéro de téléphone, wilaya, commune, mode de livraison) et confirmez. ",
          { label: "Voir la collection", href: routes.collection },
          ".",
        ],
      },
      {
        question: "Comment savoir si ma commande est confirmée ?",
        answer: [
          "Après votre commande, elle est « reçue » : nous vous appelons pour confirmer la commande, la taille et l'adresse avant l'expédition. La commande n'est confirmée qu'après cet appel, alors gardez votre téléphone à portée de main.",
        ],
      },
      {
        question: "Puis-je modifier ou annuler ma commande ?",
        answer: [
          "Oui, tant qu'elle n'est pas expédiée. Contactez-nous rapidement sur ",
          whatsapp,
          " avec votre nom et le produit commandé, ou dites-le-nous lors de l'appel de confirmation.",
        ],
      },
      {
        question: "Comment vous contacter ?",
        answer: [
          "Sur ",
          whatsapp,
          ", par téléphone au ",
          { label: CONTACT.phone.display, href: CONTACT.phone.href },
          ", sur Instagram (",
          { label: CONTACT.instagram.handle, href: CONTACT.instagram.href },
          ") ou avec le ",
          { label: "formulaire de contact", href: routes.contact },
          ".",
        ],
      },
    ],
  },
  {
    id: "livraison",
    title: "Livraison",
    items: [
      {
        question: "Dans quelles wilayas livrez-vous ?",
        answer: [
          `Dans les ${WILAYA_COUNT} wilayas d'Algérie, avec notre transporteur Anderson, au départ d'Alger. Quelques wilayas du Sud n'ont pas de bureau (stop desk)\u00a0: la livraison s'y fait à domicile. Vous habitez dans une nouvelle wilaya\u00a0? Choisissez votre ancienne wilaya de rattachement. `,
          { label: "Voir la page Livraison", href: routes.delivery },
          ".",
        ],
      },
      {
        question: "Combien coûte la livraison ?",
        answer: [
          "Le prix dépend de votre wilaya et du mode de livraison, à domicile ou au bureau (stop desk). Certains produits offrent une réduction ou la livraison gratuite selon la quantité. ",
          { label: "Voir les tarifs par wilaya", href: routes.delivery },
          ".",
        ],
      },
      {
        question: "Quels sont les délais de livraison ?",
        answer: [
          "Ils dépendent de votre wilaya, à partir de l'expédition depuis Alger. Le délai estimé de chaque wilaya est indiqué dans le formulaire de commande et sur la page Livraison. ",
          { label: "Voir les délais par wilaya", href: routes.delivery },
          ".",
        ],
      },
    ],
  },
  {
    id: "paiement",
    title: "Paiement",
    items: [
      {
        question: "Comment se passe le paiement ?",
        answer: [
          "Uniquement à la livraison : vous payez en espèces à la réception de votre colis. Aucun paiement en ligne, aucune carte demandée.",
        ],
      },
    ],
  },
  {
    id: "echanges",
    title: "Échanges",
    items: [
      {
        question: "Comment fonctionnent les échanges ?",
        answer: [
          "L'échange se demande le jour de la livraison, sur ",
          whatsapp,
          ". Le produit doit être non porté et dans son état d'origine, et les frais de livraison de l'échange sont à votre charge. ",
          { label: "Lire la politique d'échange", href: routes.exchanges },
          ".",
        ],
      },
    ],
  },
  {
    id: "tailles",
    title: "Tailles",
    items: [
      {
        question: "Comment choisir ma taille ?",
        answer: [
          "Nos pièces sont en coupe oversize : prenez votre taille habituelle pour un tombé ample, une taille en dessous pour une coupe plus ajustée. ",
          { label: "Voir le guide des tailles", href: routes.sizeGuide },
          ".",
        ],
      },
    ],
  },
];

/** The answer as plain text, for the FAQ structured data. */
export function faqAnswerText(answer: readonly FaqAnswerPart[]): string {
  return answer.map((part) => (typeof part === "string" ? part : part.label)).join("");
}
