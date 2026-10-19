import Image from "next/image";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Container } from "@/components/ui/container";
import { HandQuote } from "@/components/ui/hand-quote";
import { SectionLabel } from "@/components/ui/section-label";
import { SectionTitle } from "@/components/ui/section-title";
import { routes } from "@/lib/routes";

const LOOKBOOK_PHOTOS: readonly { src: string; alt: string }[] = [
  {
    src: "/images/lookbook/lookbook-1.jpg",
    alt: "T-shirt crème oversize vu de dos, avec un grand imprimé graphique noir, porté devant des piliers en béton",
  },
  {
    src: "/images/lookbook/lookbook-2.jpg",
    alt: "Jeune femme au regard intense, en hoodie noir oversize, assise devant un mur en béton",
  },
  {
    src: "/images/lookbook/lookbook-3.jpg",
    alt: "Jeune homme en hoodie et pantalon noirs, assis sur des marches en béton, le regard tourné vers la lumière",
  },
  {
    src: "/images/lookbook/lookbook-4.jpg",
    alt: "Hoodie noir RASSM vu de dos, avec un imprimé géométrique et le logo RASSM, devant un mur en béton",
  },
];

export function LookbookStrip() {
  return (
    <section aria-labelledby="lookbook-title" className="bg-bone py-10 md:py-12 lg:py-3">
      <Container className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,4.6fr)] lg:items-center lg:gap-6">
        <div>
          <SectionLabel>Lookbook</SectionLabel>
          <SectionTitle
            id="lookbook-title"
            lang="en"
            className="mt-3 lg:text-[2rem] xl:text-[2.25rem]"
          >
            Real people.
            <br />
            Bigger feelings.
          </SectionTitle>
          <ArrowLink href={routes.lookbook} underline className="mt-5">
            Voir le lookbook
          </ArrowLink>
        </div>

        <ul className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,0.72fr)]">
          {LOOKBOOK_PHOTOS.map((photo) => (
            <li key={photo.src} className="relative aspect-[4/5] overflow-hidden lg:aspect-[11/12]">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(min-width: 1024px) 17vw, (min-width: 768px) 22vw, 50vw"
                className="object-cover"
              />
            </li>
          ))}
          <li className="col-span-2 flex items-center justify-center bg-onyx px-4 py-10 text-paper md:col-span-1 md:py-0">
            <HandQuote
              lines={["Draw", "what", "you", "can't", "say."]}
              tilted={false}
              className="text-[1.65rem] md:text-[1.35rem] lg:text-[1.6rem]"
            />
          </li>
        </ul>
      </Container>
    </section>
  );
}
