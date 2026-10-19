import Image from "next/image";
import type { ComponentType, SVGProps } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HandQuote } from "@/components/ui/hand-quote";
import { CirclesIcon, GlobeIcon, SparkleIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/section-label";
import { SectionTitle } from "@/components/ui/section-title";
import { routes } from "@/lib/routes";

/** Photo banner under the transparent header: "More than clothing." */
export function AboutHero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-paper">
      <Image
        src="/images/about/about-hero.jpg"
        alt="Jeune homme en hoodie noir RASSM assis sur un escalier en béton brut"
        fill
        preload
        sizes="100vw"
        className="-z-20 object-cover object-[60%_30%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-ink/90 via-ink/55 to-ink/30 md:bg-linear-to-r md:from-ink/90 md:via-ink/50 md:to-ink/10"
      />
      <Container className="relative flex min-h-[380px] flex-col justify-end pt-28 pb-10 md:min-h-[400px] md:pb-12 lg:justify-center lg:pt-24 lg:pb-12">
        <SectionLabel className="text-mist">À propos de RASSM</SectionLabel>
        <SectionTitle as="h1" lang="en" className="mt-4 lg:text-[4rem]">
          More than
          <br />
          clothing.
        </SectionTitle>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-mist md:text-base">
          RASSM est une marque de streetwear créative, née de vraies personnes, de vraies émotions
          et d&apos;une vision plus profonde. Nous créons plus que des vêtements : une toile pour ce
          qui vit en vous.
        </p>
        <HandQuote
          lines={["Same", "thoughts.", "Different", "stories."]}
          className="absolute top-1/2 right-6 hidden -translate-y-1/3 text-[1.6rem] text-paper md:block lg:right-16"
        />
      </Container>
    </section>
  );
}

/** "Notre histoire": photo, text, photo with a handwritten quote. */
export function AboutStory() {
  return (
    <section aria-labelledby="story-title" className="bg-bone">
      <div className="mx-auto grid max-w-[1536px] gap-8 px-4 py-6 sm:px-6 md:grid-cols-2 md:py-8 lg:grid-cols-[1.05fr_0.95fr_1.05fr] lg:gap-10 lg:px-10 lg:py-5">
        <div className="relative aspect-[4/3] bg-graphite md:aspect-auto md:min-h-[360px]">
          <Image
            src="/images/about/about-story-1.jpg"
            alt="Jeune homme de dos en t-shirt RASSM crème, imprimé croquis dans le dos"
            fill
            sizes="(min-width: 1024px) 34vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover object-[60%_35%]"
          />
        </div>

        <div className="flex flex-col justify-center py-4 md:py-8 lg:py-10">
          <SectionLabel>Notre histoire</SectionLabel>
          <SectionTitle
            id="story-title"
            lang="en"
            className="mt-3 text-[2.25rem] md:text-[2.6rem] lg:text-[2.75rem]"
          >
            Art lives
            <br />
            in all of us.
          </SectionTitle>
          <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-ash">
            <p>
              RASSM est né d&apos;une vérité simple : certains sentiments ne se disent pas, ils se
              dessinent.
            </p>
            <p>
              Nous créons du streetwear oversize pour les penseurs, les hypersensibles, les
              discrets, et pour tous ceux qui voient le monde un peu plus en profondeur. Chaque
              pièce est le reflet d&apos;une émotion humaine, d&apos;une identité et d&apos;un geste
              créatif.
            </p>
            <p>Une marque née en Algérie, pensée pour ceux qui ont quelque chose à dire.</p>
          </div>
          <Button href={routes.collection} surface="light" withArrow className="mt-7 self-start">
            Notre collection
          </Button>
        </div>

        <div className="relative isolate aspect-[4/3] overflow-hidden bg-graphite text-paper md:col-span-2 md:aspect-[16/7] lg:col-span-1 lg:aspect-auto lg:min-h-[360px]">
          <Image
            src="/images/about/about-story-2.jpg"
            alt="Jeune femme en hoodie noir RASSM, assise devant un mur en béton"
            fill
            sizes="(min-width: 1024px) 34vw, 100vw"
            className="-z-20 object-cover object-[35%_30%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-l from-ink/55 via-ink/10 to-transparent"
          />
          <HandQuote
            lines={["Different", "thoughts", "same", "human."]}
            className="absolute top-1/2 right-5 -translate-y-1/2 text-[1.4rem] md:right-8 lg:text-[1.5rem]"
          />
        </div>
      </div>
    </section>
  );
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const VALUES: readonly { title: string; lines: readonly string[]; Icon: Icon }[] = [
  {
    title: "Authenticité",
    lines: ["Des histoires vraies.", "Aucun faux-semblant."],
    Icon: SparkleIcon,
  },
  {
    title: "Créativité",
    lines: ["L'art dans tout ce", "que nous faisons."],
    Icon: CirclesIcon,
  },
  { title: "Liberté", lines: ["Portez vos pensées.", "Sans limites."], Icon: GlobeIcon },
];

/** Dark band over a concrete photo: "What we stand for." and the three values. */
export function AboutValues() {
  return (
    <section
      aria-labelledby="values-title"
      className="relative isolate overflow-hidden bg-onyx text-paper"
    >
      <Image
        src="/images/about/about-values.jpg"
        alt=""
        fill
        sizes="100vw"
        className="-z-20 object-cover object-[70%_50%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-r from-onyx/95 via-onyx/80 to-onyx/65"
      />
      <Container className="grid gap-12 py-14 md:py-16 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-10 lg:py-14">
        <div>
          <SectionLabel className="text-mist">Nos valeurs</SectionLabel>
          <SectionTitle id="values-title" lang="en" className="mt-4">
            What
            <br />
            we stand for.
          </SectionTitle>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-mist">
            RASSM repose sur l&apos;authenticité, la créativité et la liberté. Nous croyons en ceux
            qui pensent autrement, qui ressentent profondément et qui s&apos;expriment sans limites.
          </p>
        </div>
        <ul className="grid gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-paper/25">
          {VALUES.map(({ title, lines, Icon }) => (
            <li key={title} className="flex flex-col items-center px-4 py-2 text-center sm:py-6">
              <Icon className="text-paper" />
              <h3 className="mt-5 text-sm font-semibold tracking-button uppercase">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist">
                {lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** Light closing band (not in the design): invitation to the current drop. */
export function AboutClosing() {
  return (
    <section aria-labelledby="closing-title" className="border-b border-line bg-bone">
      <Container className="flex flex-col items-start gap-6 py-14 md:flex-row md:items-center md:justify-between md:py-16">
        <div>
          <SectionLabel className="text-stone">Drop 001</SectionLabel>
          <h2
            id="closing-title"
            className="mt-3 max-w-xl font-display text-3xl leading-[1.05] font-medium uppercase md:text-[2.4rem]"
          >
            Trouvez la pièce qui parle pour vous.
          </h2>
        </div>
        <Button href={routes.collection} surface="light" withArrow className="shrink-0">
          Découvrir la collection
        </Button>
      </Container>
    </section>
  );
}
