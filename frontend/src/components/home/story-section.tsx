import Image from "next/image";
import { ArrowLink } from "@/components/ui/arrow-link";
import { SectionLabel } from "@/components/ui/section-label";
import { SectionTitle } from "@/components/ui/section-title";
import { routes } from "@/lib/routes";

/**
 * Graphite band: close-up photo, brand story, full-body photo.
 * The handwritten quotes are part of the photos themselves (in English, as painted on
 * the wall), so they are not overlaid here; the alt texts give them in French.
 * Crops: the quote and the person must stay visible, on every screen size.
 */
export function StorySection() {
  return (
    <section
      aria-labelledby="story-title"
      className="grid bg-graphite text-paper lg:min-h-[400px] lg:grid-cols-[1.2fr_1fr_0.6fr]"
    >
      <div className="relative aspect-[4/3] md:aspect-[16/9] lg:aspect-auto">
        <Image
          src="/images/story/story-1.jpg"
          alt={`Jeune homme aux cheveux bouclés, tête baissée, en hoodie noir devant un mur en béton. Citation manuscrite sur le mur : « Pensées différentes, même humain. »`}
          fill
          sizes="(min-width: 1024px) 43vw, 100vw"
          className="object-cover object-[50%_35%] lg:object-[50%_40%]"
        />
      </div>

      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 md:px-12 lg:px-10 lg:py-10 xl:px-14">
        <SectionLabel className="text-mist">Notre histoire</SectionLabel>
        <SectionTitle id="story-title" className="mt-4">
          L&apos;art vit
          <br />
          en chacun de nous.
        </SectionTitle>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-mist">
          RASSM est né d&apos;une vérité simple : certains sentiments ne se disent pas, ils se
          dessinent. Nous créons des vêtements oversize pour les penseurs, les hypersensibles, les
          silencieux. Une toile pour votre monde intérieur.
        </p>
        <ArrowLink href={routes.about} underline className="mt-6 self-start">
          À propos de RASSM
        </ArrowLink>
      </div>

      <div className="relative aspect-[4/3] lg:aspect-auto">
        <Image
          src="/images/story/story-2.jpg"
          alt={`Jeune homme en hoodie noir marchant, vu de dos, sous une structure en béton brut. Citation manuscrite sur le mur : « Mêmes personnes, histoires différentes. »`}
          fill
          sizes="(min-width: 1024px) 22vw, 100vw"
          className="object-cover object-[50%_45%] lg:object-center"
        />
      </div>
    </section>
  );
}
