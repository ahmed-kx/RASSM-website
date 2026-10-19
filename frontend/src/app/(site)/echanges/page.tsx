import type { Metadata } from "next";
import Link from "next/link";
import {
  InfoPage,
  InfoSection,
  NumberedSteps,
  Prose,
  proseLink,
} from "@/components/info/info-page";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon, WhatsAppIcon } from "@/components/ui/icons";
import { CONTACT, whatsappLink } from "@/content/contact";
import { routes } from "@/lib/routes";

const description =
  "Échange possible le jour de la livraison : produit non porté, dans son état d'origine. Demandez votre échange sur WhatsApp.";

export const metadata: Metadata = {
  title: "Échanges",
  description,
  alternates: { canonical: routes.exchanges },
  openGraph: { title: "Échanges | RASSM", description },
};

const EXCHANGE_MESSAGE =
  "Bonjour RASSM, je souhaite demander un échange. Mon nom : … Ma commande (produit, taille) : … La taille ou la couleur souhaitée : …";

const STEPS = [
  {
    title: "Demandez l'échange le jour de la livraison",
    text: (
      <>
        Écrivez-nous sur WhatsApp au{" "}
        <a
          href={CONTACT.whatsapp.href}
          target="_blank"
          rel="noopener noreferrer"
          className={proseLink}
        >
          {CONTACT.whatsapp.display}
        </a>{" "}
        le jour où vous recevez votre colis, avec votre nom, le produit reçu et la taille ou la
        couleur souhaitée. Passé ce jour, l&apos;échange n&apos;est plus possible.
      </>
    ),
  },
  {
    title: "Gardez le produit intact",
    text: "Le produit doit être non porté et dans son état d'origine, tel que vous l'avez reçu.",
  },
  {
    title: "Les frais de livraison sont à votre charge",
    text: "Les frais de livraison de l'échange sont payés par vous.",
  },
  {
    title: "Nous vérifions le produit",
    text: "Si le produit ne revient pas dans le même état, l'échange n'a pas lieu : nous vous renvoyons le même produit.",
  },
] as const;

export default function ExchangesPage() {
  return (
    <InfoPage
      label="Service client"
      title="Échanges"
      intro={
        <p>
          La taille ne vous va pas&nbsp;? Vous pouvez échanger votre pièce, à condition de nous le
          demander le jour de la livraison. Voici comment faire, en quatre étapes.
        </p>
      }
    >
      <InfoSection id="exchange-steps" title="Comment échanger">
        <NumberedSteps steps={STEPS} />
        <a
          href={whatsappLink(EXCHANGE_MESSAGE)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses("filled", "light", "mt-8 w-full sm:w-auto")}
        >
          <WhatsAppIcon width={18} height={18} />
          <span>Demander un échange</span>
          <ArrowRightIcon className="transition-transform duration-200 motion-safe:group-hover:translate-x-1" />
        </a>
        <p className="mt-3 text-[13px] text-stone">
          Ouvre WhatsApp avec un message prêt à compléter. Vous pouvez aussi nous appeler au{" "}
          <a href={CONTACT.phone.href} className={proseLink}>
            {CONTACT.phone.display}
          </a>
          .
        </p>
      </InfoSection>

      <InfoSection id="exchange-size" title="Avant de commander">
        <Prose>
          <p>
            Le plus simple reste de choisir la bonne taille dès le départ : nos pièces sont en coupe
            oversize.{" "}
            <Link href={routes.sizeGuide} className={proseLink}>
              Consultez le guide des tailles
            </Link>{" "}
            pour comparer avec un vêtement que vous aimez. Une autre question&nbsp;?{" "}
            <Link href={routes.faq} className={proseLink}>
              Consultez la FAQ
            </Link>
            .
          </p>
        </Prose>
      </InfoSection>
    </InfoPage>
  );
}
