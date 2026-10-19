import type { Metadata } from "next";
import { AboutHero, AboutStory, AboutValues } from "@/components/about/about-sections";
import { routes } from "@/lib/routes";

const description =
  "RASSM, marque de mode urbaine créative née en Algérie : des hoodies, sweatshirts et t-shirts oversize pour ceux qui pensent autrement et ressentent profondément.";

export const metadata: Metadata = {
  title: "À propos",
  description,
  alternates: { canonical: routes.about },
  openGraph: {
    title: "À propos | RASSM",
    description,
    images: [
      {
        url: "/images/about/about-hero.jpg",
        width: 1672,
        height: 941,
        alt: "Jeune homme en hoodie noir RASSM assis sur un escalier en béton brut",
      },
    ],
  },
};

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <AboutStory />
      <AboutValues />
    </>
  );
}
