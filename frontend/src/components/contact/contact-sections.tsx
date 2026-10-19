import Image from "next/image";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HandQuote } from "@/components/ui/hand-quote";
import { InstagramIcon, LinkIcon, PhoneIcon, WhatsAppIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/section-label";
import { SectionTitle } from "@/components/ui/section-title";
import { CONTACT } from "@/content/contact";
import { routes } from "@/lib/routes";

/** Photo banner under the transparent header: "Parlons-en." */
export function ContactHero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-paper">
      <Image
        src="/images/contact/contact-hero.jpg"
        alt=""
        fill
        preload
        sizes="100vw"
        className="-z-20 object-cover object-[70%_30%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-ink/90 via-ink/50 to-ink/30 md:bg-linear-to-r md:from-ink/85 md:via-ink/45 md:to-ink/10"
      />
      <Container className="relative flex min-h-[340px] flex-col justify-end pt-28 pb-10 md:pb-12 lg:min-h-[360px] lg:justify-center lg:pt-20 lg:pb-8">
        <SectionLabel className="text-mist">Contact</SectionLabel>
        <SectionTitle as="h1" className="mt-4">
          Parlons-en.
        </SectionTitle>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-mist md:text-base">
          Une question, une collaboration ou simplement envie de partager vos pensées ? Nous serions
          ravis de vous lire.
        </p>
        <HandQuote
          lines={["Mêmes", "pensées.", "Histoires", "différentes."]}
          className="absolute top-1/2 right-6 hidden -translate-y-1/3 text-[1.6rem] text-paper md:block lg:right-16"
        />
      </Container>
    </section>
  );
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const externalLink = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

const valueLink = "text-sm text-ink underline-offset-4 hover:underline";

function Channel({
  Icon,
  title,
  children,
  note,
}: {
  Icon: Icon;
  title: string;
  children: ReactNode;
  note: string;
}) {
  return (
    <li className="flex gap-5">
      <span className="grid size-11 shrink-0 place-items-center bg-ink text-paper">
        <Icon width={22} height={22} />
      </span>
      <div>
        <h3 className="font-display text-lg leading-none font-medium tracking-[0.08em] uppercase">
          {title}
        </h3>
        <p className="mt-2">{children}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ash">{note}</p>
      </div>
    </li>
  );
}

/** "Autres moyens de nous joindre": WhatsApp, phone, Instagram, collaborations. */
export function ContactChannels() {
  return (
    <div>
      <SectionLabel as="h2">Autres moyens de nous joindre</SectionLabel>
      <ul className="mt-8 space-y-8">
        <Channel Icon={WhatsAppIcon} title="WhatsApp" note="Réponse rapide sur WhatsApp.">
          <a
            href={CONTACT.whatsapp.href}
            {...externalLink}
            aria-label={`Écrire sur WhatsApp au ${CONTACT.whatsapp.display}`}
            className={valueLink}
          >
            {CONTACT.whatsapp.display}
          </a>
        </Channel>
        <Channel
          Icon={PhoneIcon}
          title="Téléphone"
          note="Appelez-nous pour toute question sur votre commande."
        >
          <a
            href={CONTACT.phone.href}
            aria-label={`Appeler le ${CONTACT.phone.display}`}
            className={valueLink}
          >
            {CONTACT.phone.display}
          </a>
        </Channel>
        <Channel
          Icon={InstagramIcon}
          title="Instagram"
          note="Suivez-nous pour les nouveaux drops et les coulisses."
        >
          <a href={CONTACT.instagram.href} {...externalLink} className={valueLink}>
            {CONTACT.instagram.handle}
          </a>
        </Channel>
        <Channel
          Icon={LinkIcon}
          title="Collaborations"
          note="Artistes, créateurs, marques : créons ensemble."
        >
          <span className="text-sm">
            Par{" "}
            <a href={CONTACT.whatsapp.href} {...externalLink} className={valueLink}>
              WhatsApp
            </a>{" "}
            ou{" "}
            <a href={CONTACT.instagram.href} {...externalLink} className={valueLink}>
              Instagram
            </a>
          </span>
        </Channel>
      </ul>
    </div>
  );
}

/** Dark band: "Besoin d'une réponse rapide ?" with a link to the FAQ. */
export function FaqBand() {
  return (
    <section
      aria-labelledby="faq-band-title"
      className="relative isolate overflow-hidden bg-onyx text-paper"
    >
      <Image
        src="/images/contact/contact-faq.jpg"
        alt=""
        fill
        sizes="100vw"
        className="-z-20 object-cover"
      />
      {/* Keeps the text readable over the photo. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-r from-onyx/90 via-onyx/65 to-onyx/45"
      />
      <Container className="flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between md:py-8">
        <div>
          <SectionLabel className="text-mist">Questions fréquentes</SectionLabel>
          <h2
            id="faq-band-title"
            className="mt-3 font-display text-3xl leading-none font-medium uppercase md:text-[2.6rem]"
          >
            Besoin d&apos;une réponse rapide&nbsp;?
          </h2>
          <p className="mt-3 text-[15px] text-mist">
            Livraison, échanges, tailles : retrouvez les réponses dans notre FAQ.
          </p>
        </div>
        <Button
          href={routes.faq}
          variant="outlined"
          surface="dark"
          withArrow
          className="shrink-0 self-start whitespace-nowrap md:self-auto"
        >
          Voir la FAQ
        </Button>
      </Container>
    </section>
  );
}

/** "Une marque algérienne." with the map of Algeria (placeholder until the artwork exists). */
export function BrandLocation() {
  return (
    <section aria-labelledby="brand-title" className="grid bg-bone lg:grid-cols-[44%_56%]">
      <div className="px-4 py-12 sm:px-6 md:py-14 lg:py-12 lg:pr-10 lg:pl-[max(3rem,calc((100vw-1440px)/2+3rem))]">
        <SectionLabel>Notre marque</SectionLabel>
        <SectionTitle id="brand-title" className="mt-4 text-[2.25rem] md:text-5xl lg:text-[3rem]">
          Une marque algérienne.
        </SectionTitle>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ash">
          RASSM est née en Algérie. Nos pièces sont livrées dans les 58 wilayas, et vous payez à la
          livraison.
        </p>
      </div>
      <div className="relative isolate min-h-64 overflow-hidden bg-onyx text-paper md:min-h-80">
        <Image
          src="/images/contact/algeria-map.jpg"
          alt="Carte stylisée de l'Algérie"
          fill
          sizes="(min-width: 1024px) 56vw, 100vw"
          className="-z-10 object-cover object-[25%_center] lg:object-center"
        />
        <HandQuote
          lines={["L'art", "nous relie", "partout."]}
          className="absolute top-1/2 right-6 -translate-y-1/2 text-[1.5rem] md:right-12 lg:right-16"
        />
      </div>
    </section>
  );
}
