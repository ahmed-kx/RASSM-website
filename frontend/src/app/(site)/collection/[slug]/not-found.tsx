import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { routes } from "@/lib/routes";

export default function ProductNotFound() {
  return (
    <Container
      size="narrow"
      className="flex min-h-[60svh] flex-col items-start justify-center py-20"
    >
      <SectionLabel className="text-stone">Erreur 404</SectionLabel>
      <h1 className="mt-4 font-display text-5xl leading-[0.95] font-medium uppercase md:text-6xl">
        Produit introuvable
      </h1>
      <p className="mt-4 max-w-md text-[15px] text-ash">
        Ce produit n&apos;existe pas ou n&apos;est plus disponible. Découvrez le reste de la
        collection.
      </p>
      <Button href={routes.collection} surface="light" withArrow className="mt-8">
        Voir la collection
      </Button>
    </Container>
  );
}
