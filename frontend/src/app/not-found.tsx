import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Page introuvable" };

/** 404 of the whole site (root layout only, so it brings the site header and footer). */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="contenu">
        <Container
          size="narrow"
          className="flex min-h-[60svh] flex-col items-start justify-center py-20"
        >
          <SectionLabel className="text-stone">Erreur 404</SectionLabel>
          <h1 className="mt-4 font-display text-5xl leading-[0.95] font-medium uppercase md:text-6xl">
            Page introuvable
          </h1>
          <p className="mt-4 max-w-md text-[15px] text-ash">
            Cette page n&apos;existe pas ou n&apos;est pas encore disponible.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href={routes.collection} surface="light" withArrow>
              Voir la collection
            </Button>
            <Button href={routes.home} variant="outlined" surface="light">
              Retour à l&apos;accueil
            </Button>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
