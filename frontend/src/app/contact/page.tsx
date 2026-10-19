import type { Metadata } from "next";
import Image from "next/image";
import { ContactForm } from "@/components/contact/contact-form";
import {
  BrandLocation,
  ContactChannels,
  ContactHero,
  FaqBand,
} from "@/components/contact/contact-sections";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { SectionTitle } from "@/components/ui/section-title";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Une question sur une commande, un échange ou une collaboration ? Écrivez à RASSM par le formulaire, sur WhatsApp ou sur Instagram.",
  alternates: { canonical: routes.contact },
  openGraph: {
    title: "Contact | RASSM",
    description:
      "Écrivez à RASSM par le formulaire, sur WhatsApp ou sur Instagram. Nous vous répondons rapidement.",
  },
};

export default function ContactPage() {
  return (
    <>
      <ContactHero />

      <section aria-labelledby="contact-form-title" className="bg-bone">
        <Container className="grid gap-12 py-12 md:grid-cols-2 md:gap-10 md:py-14 lg:grid-cols-[1.2fr_0.95fr_0.8fr] lg:gap-12 lg:py-6">
          <div className="md:col-span-2 lg:col-span-1 lg:py-8">
            <SectionLabel>Envoyez-nous un message</SectionLabel>
            <SectionTitle
              id="contact-form-title"
              lang="en"
              className="mt-3 text-[2.25rem] md:text-[2.6rem] lg:text-[2.6rem]"
            >
              We&apos;re here
              <br />
              for you.
            </SectionTitle>
            <ContactForm />
          </div>

          <div className="lg:py-8">
            <ContactChannels />
          </div>

          <div className="relative hidden min-h-[420px] bg-graphite md:block lg:my-0">
            <Image
              src="/images/contact/contact-side.jpg"
              alt="Jeune homme de dos en hoodie RASSM, montant un escalier en béton"
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-cover"
            />
          </div>
        </Container>
      </section>

      <FaqBand />
      <BrandLocation />
    </>
  );
}
