import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { routes } from "@/lib/routes";

/** "New Drop 001" banner under the product grid. */
export function PromoBanner() {
  return (
    <section
      aria-labelledby="drop-banner-title"
      className="grid overflow-hidden md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
    >
      <div className="relative min-h-[220px] text-paper md:min-h-[260px]">
        <Image
          src="/images/collection/drop-banner.jpg"
          alt="Jeune homme en hoodie noir assis sur des marches en béton, tête baissée"
          fill
          sizes="(min-width: 1024px) 50vw, (min-width: 768px) 66vw, 100vw"
          className="object-cover object-[50%_35%]"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-ink/75 to-ink/10" />
        <div className="absolute inset-x-0 top-0 p-6 md:p-8" lang="en">
          <SectionLabel>RASSM</SectionLabel>
          <p className="mt-5 flex items-center gap-4 font-display text-2xl uppercase md:text-[1.75rem]">
            New Drop 001
            <span aria-hidden="true" className="h-px w-10 bg-paper/70" />
          </p>
          <span aria-hidden="true" className="mt-3 block h-px w-10 bg-paper/60" />
        </div>
      </div>
      <div className="flex flex-col justify-center bg-onyx px-6 py-10 text-paper md:px-8">
        <h2
          id="drop-banner-title"
          lang="en"
          className="font-display text-[1.75rem] leading-[1.05] font-medium uppercase lg:text-[1.9rem]"
        >
          Different thoughts.
          <br />
          Same human.
        </h2>
        <Button
          href={`${routes.collection}?sort=new`}
          variant="outlined"
          surface="dark"
          withArrow
          className="mt-6 self-start"
        >
          Découvrir
        </Button>
      </div>
    </section>
  );
}
