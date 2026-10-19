import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/section-label";
import { SectionTitle } from "@/components/ui/section-title";
import type { CategoryCard } from "@/lib/data/categories";

/** Graphite band: "Wear your silence." and the three category cards. */
export function CollectionSection({ categories }: { categories: readonly CategoryCard[] }) {
  return (
    <section aria-labelledby="collection-title" className="bg-graphite text-paper">
      <Container className="grid gap-8 py-12 md:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,3.1fr)] lg:items-center lg:gap-12 lg:py-5">
        <div>
          <SectionLabel className="text-mist">La collection</SectionLabel>
          <SectionTitle id="collection-title" lang="en" className="mt-4">
            Wear
            <br />
            your
            <br />
            silence.
          </SectionTitle>
          <p className="mt-4 max-w-[16rem] text-[15px] leading-snug text-mist">
            Des essentiels oversize pour un monde intérieur qui parle plus fort.
          </p>
        </div>

        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
          {categories.map((card) => (
            <li key={card.category} className="w-[78%] shrink-0 snap-start sm:w-[46%] md:w-auto">
              <Link
                href={card.href}
                className="group relative block aspect-[4/5] overflow-hidden ring-1 ring-paper/15 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-paper lg:aspect-[4/3]"
              >
                <Image
                  src={card.image}
                  alt={card.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 24vw, (min-width: 768px) 31vw, 78vw"
                  className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-linear-to-t from-ink/80 via-ink/10 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 p-4 lg:p-5">
                  <h3 className="font-display text-[1.65rem] leading-none font-medium uppercase">
                    {card.label}
                  </h3>
                  <span className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold tracking-button uppercase">
                    Découvrir
                    <ArrowRightIcon
                      width={14}
                      height={14}
                      className="transition-transform duration-200 motion-safe:group-hover:translate-x-1"
                    />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
