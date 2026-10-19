import type { Metadata } from "next";
import Link from "next/link";
import {
  InfoNote,
  InfoPage,
  InfoSection,
  NumberedSteps,
  Prose,
  proseLink,
} from "@/components/info/info-page";
import { SizeGuideTable } from "@/components/product/size-guide-table";
import { SIZE_GUIDE_FIT } from "@/content/size-guide";
import { routes } from "@/lib/routes";

const description =
  "Guide des tailles RASSM : mesures des hoodies, sweatshirts et t-shirts oversize, et comment prendre vos mesures (poitrine, longueur, manches).";

export const metadata: Metadata = {
  title: "Guide des tailles",
  description,
  alternates: { canonical: routes.sizeGuide },
  openGraph: { title: "Guide des tailles | RASSM", description },
};

const MEASURES = [
  {
    title: "Largeur poitrine",
    text: "Posez à plat un vêtement qui vous va bien. Mesurez d'une couture à l'autre, juste sous les manches.",
  },
  {
    title: "Longueur",
    text: "Du point le plus haut de l'épaule, à côté du col, jusqu'au bas du vêtement.",
  },
  {
    title: "Épaules",
    text: "D'une couture d'épaule à l'autre, en ligne droite dans le dos.",
  },
  {
    title: "Manches",
    text: "De la couture de l'épaule jusqu'au bout de la manche.",
  },
] as const;

export default function SizeGuidePage() {
  return (
    <InfoPage
      label="Service client"
      title="Guide des tailles"
      intro={
        <p>
          Nos hoodies, sweatshirts et t-shirts sont pensés en coupe oversize : épaules tombantes,
          volume ample, longueur généreuse. Comparez nos mesures avec un vêtement que vous aimez
          porter.
        </p>
      }
    >
      <InfoSection id="size-table" title="Les mesures">
        <Prose className="mb-6">
          <p>{SIZE_GUIDE_FIT}</p>
        </Prose>
        <SizeGuideTable />
      </InfoSection>

      <InfoSection id="size-fit" title="La coupe oversize">
        <Prose>
          <p>
            Une pièce oversize est volontairement plus large qu&apos;une coupe classique. Votre
            taille habituelle donne le tombé ample voulu, avec des épaules qui descendent un peu sur
            le haut du bras. Si vous préférez une silhouette plus près du corps, prenez une taille
            en dessous.
          </p>
          <p>
            Entre deux tailles&nbsp;? Choisissez la plus grande pour garder l&apos;esprit oversize.
          </p>
        </Prose>
      </InfoSection>

      <InfoSection id="size-measure" title="Comment prendre vos mesures">
        <Prose className="mb-6">
          <p>
            Le plus fiable est de mesurer un vêtement que vous portez déjà, posé bien à plat, avec
            un mètre ruban.
          </p>
        </Prose>
        <NumberedSteps steps={MEASURES} />
        <div className="mt-8">
          <InfoNote>
            La taille ne convient pas à la réception&nbsp;?{" "}
            <Link href={routes.exchanges} className={proseLink}>
              Échange possible le jour de la livraison
            </Link>
            . Un doute avant de commander&nbsp;?{" "}
            <Link href={routes.contact} className={proseLink}>
              Écrivez-nous
            </Link>
            , nous vous conseillons.
          </InfoNote>
        </div>
      </InfoSection>
    </InfoPage>
  );
}
