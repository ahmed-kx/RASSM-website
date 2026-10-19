import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/info/faq-accordion";
import { InfoPage, proseLink } from "@/components/info/info-page";
import { FAQ_GROUPS, faqAnswerText } from "@/content/faq";
import { routes } from "@/lib/routes";

const description =
  "Questions fréquentes RASSM : commande sur la page produit, paiement à la livraison, délais et tarifs dans les 58 wilayas, échanges et tailles.";

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description,
  alternates: { canonical: routes.faq },
  openGraph: { title: "Questions fréquentes | RASSM", description },
};

/** FAQPage structured data, built from the same content as the accordion. */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  inLanguage: "fr",
  mainEntity: FAQ_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: faqAnswerText(item.answer) },
    })),
  ),
};

export default function FaqPage() {
  return (
    <InfoPage
      label="Questions fréquentes"
      title="FAQ"
      intro={
        <p>
          Commande, livraison, paiement, échanges, tailles : les réponses aux questions que vous
          nous posez le plus souvent.
        </p>
      }
    >
      <script
        type="application/ld+json"
        // "<" is escaped so the content can never close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <FaqAccordion groups={FAQ_GROUPS} />
      <p className="text-[15px] leading-relaxed text-ash">
        Vous ne trouvez pas votre réponse&nbsp;?{" "}
        <Link href={routes.contact} className={proseLink}>
          Écrivez-nous
        </Link>
        , nous vous répondons rapidement.
      </p>
    </InfoPage>
  );
}
