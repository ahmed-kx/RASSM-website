import Image from "next/image";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { SectionTitle } from "@/components/ui/section-title";

/** Photo banner at the top of /collection, under the transparent header. */
export function CollectionHero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-paper">
      <Image
        src="/images/collection/collection-hero.jpg"
        alt="Jeune homme en hoodie noir RASSM devant une structure en béton brut"
        fill
        preload
        sizes="100vw"
        className="-z-20 object-cover object-[70%_30%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-ink/90 via-ink/50 to-ink/30 md:bg-linear-to-r md:from-ink/90 md:via-ink/55 md:to-ink/10"
      />
      <Container
        size="narrow"
        className="flex min-h-[330px] flex-col justify-end pt-28 pb-10 md:min-h-[340px] md:pb-12 lg:min-h-[330px] lg:justify-center lg:pt-20 lg:pb-8"
      >
        <SectionLabel className="text-mist">La collection</SectionLabel>
        <SectionTitle as="h1" className="mt-4">
          Portez
          <br />
          votre silence.
        </SectionTitle>
        <p className="mt-4 max-w-xl text-[15px] text-mist md:text-base">
          Des essentiels oversize pour un monde intérieur qui parle plus fort.
        </p>
      </Container>
    </section>
  );
}
