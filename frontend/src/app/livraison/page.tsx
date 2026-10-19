import { WILAYA_COUNT } from "@rassm/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { DeliveryRates } from "@/components/info/delivery-rates";
import {
  InfoNote,
  InfoPage,
  InfoSection,
  NumberedSteps,
  Prose,
  proseLink,
} from "@/components/info/info-page";
import { getDeliveryRates } from "@/lib/data/delivery";
import { routes } from "@/lib/routes";

const description = `Livraison dans les ${WILAYA_COUNT} wilayas d'Algérie avec Anderson, au départ d'Alger, et paiement à la livraison. Tarifs et délais à domicile ou au bureau (stop desk).`;

export const metadata: Metadata = {
  title: "Livraison",
  description,
  alternates: { canonical: routes.delivery },
  openGraph: { title: "Livraison | RASSM", description },
};

const STEPS = [
  {
    title: "Vous commandez",
    text: "Directement sur la page du produit, sans créer de compte : votre nom, votre numéro et votre adresse suffisent.",
  },
  {
    title: "Nous vous appelons",
    text: "Votre commande est reçue, mais elle n'est confirmée qu'après notre appel : nous vérifions avec vous le produit, la taille et l'adresse avant l'expédition.",
  },
  {
    title: "Anderson vous livre",
    text: "Votre colis part d'Alger avec notre transporteur Anderson, à domicile ou au bureau (stop desk) le plus proche.",
  },
  {
    title: "Vous payez à la livraison",
    text: "En espèces, à la réception du colis. Aucun paiement en ligne.",
  },
] as const;

export default async function DeliveryPage() {
  const rates = await getDeliveryRates();

  return (
    <InfoPage
      label="Service client"
      title="Livraison"
      intro={
        <p>
          Nous livrons dans les {WILAYA_COUNT} wilayas d&apos;Algérie avec notre transporteur
          Anderson, au départ d&apos;Alger. Vous payez à la livraison, et nous vous appelons pour
          confirmer chaque commande avant de l&apos;expédier.
        </p>
      }
    >
      <InfoSection id="delivery-steps" title="Comment ça se passe">
        <NumberedSteps steps={STEPS} />
      </InfoSection>

      <InfoSection id="delivery-rates" title="Tarifs et délais">
        <Prose className="mb-8">
          <p>
            Le prix dépend de votre wilaya et du mode de livraison : à domicile, ou au bureau (stop
            desk), à récupérer au point Anderson le plus proche. Les délais sont donnés à titre
            indicatif, à partir de l&apos;expédition depuis Alger.
          </p>
        </Prose>
        <DeliveryRates rates={rates} />
      </InfoSection>

      <InfoSection id="new-wilayas" title="Nouvelles wilayas">
        <InfoNote>
          Vous habitez dans une nouvelle wilaya (Aflou, Barika, Bou Saâda…)&nbsp;? Choisissez votre
          ancienne wilaya de rattachement : ce sont ses tarifs et ses délais qui s&apos;appliquent.
        </InfoNote>
      </InfoSection>

      <InfoSection id="delivery-discounts" title="Réductions sur la livraison">
        <Prose>
          <p>
            Certains produits offrent une réduction ou la livraison gratuite selon la quantité,
            indiquée sur la page du produit. La réduction s&apos;applique aux frais de livraison, à
            domicile comme au bureau, et le récapitulatif de votre commande affiche le montant final
            avant que vous confirmiez.
          </p>
          <p>
            Une question sur votre livraison&nbsp;?{" "}
            <Link href={routes.faq} className={proseLink}>
              Consultez la FAQ
            </Link>{" "}
            ou{" "}
            <Link href={routes.contact} className={proseLink}>
              contactez-nous
            </Link>
            .
          </p>
        </Prose>
      </InfoSection>
    </InfoPage>
  );
}
