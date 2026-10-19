import type { Metadata } from "next";
import { CollectionHero } from "@/components/collection/collection-hero";
import { CollectionView } from "@/components/collection/collection-view";
import { PromoBanner } from "@/components/collection/promo-banner";
import { getProducts } from "@/lib/data/products";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Collection",
  description:
    "Toute la collection RASSM : hoodies, sweatshirts et t-shirts oversize aux imprimés de croquis. Livraison dans les 58 wilayas, paiement à la livraison.",
  alternates: { canonical: routes.collection },
};

export default async function CollectionPage({ searchParams }: PageProps<"/collection">) {
  // Reading the search params renders the page per request, so a shared filtered
  // link (e.g. ?category=hoodie) arrives already filtered, with no flash.
  await searchParams;
  const products = await getProducts();

  return (
    <>
      <CollectionHero />
      <CollectionView products={products} afterGrid={<PromoBanner />} />
    </>
  );
}
