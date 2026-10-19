import type { Product } from "@rassm/shared";
import { ProductCard } from "@/components/product/product-card";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { routes } from "@/lib/routes";

export function FeaturedProducts({ products }: { products: readonly Product[] }) {
  return (
    <section aria-labelledby="featured-title" className="bg-bone py-10 md:py-12 lg:py-8">
      <Container>
        <div className="flex items-center justify-between gap-4">
          <SectionLabel as="h2" id="featured-title">
            Produits phares
          </SectionLabel>
          <ArrowLink href={routes.collection} underline>
            Voir tout
          </ArrowLink>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
