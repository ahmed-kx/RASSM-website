import type { Metadata } from "next";
import { CollectionSection } from "@/components/home/collection-section";
import { FeaturedProducts } from "@/components/home/featured-products";
import { HeroSlider } from "@/components/home/hero-slider";
import { StorySection } from "@/components/home/story-section";
import { TrustBar } from "@/components/home/trust-bar";
import { HERO_SLIDES } from "@/content/hero-slides";
import { getCategoryCards } from "@/lib/data/categories";
import { getFeaturedProducts } from "@/lib/data/products";

export const metadata: Metadata = {
  title: { absolute: "RASSM | Mode urbaine algérienne, Drop 001" },
  description:
    "RASSM, mode urbaine algérienne : hoodies, sweatshirts et t-shirts oversize aux imprimés de croquis. Découvrez le Drop 001. Livraison dans les 58 wilayas, paiement à la livraison.",
};

export default async function HomePage() {
  const [categories, featuredProducts] = await Promise.all([
    getCategoryCards(),
    getFeaturedProducts(),
  ]);

  return (
    <>
      <HeroSlider slides={HERO_SLIDES} />
      <CollectionSection categories={categories} />
      <FeaturedProducts products={featuredProducts} />
      <StorySection />
      <TrustBar />
    </>
  );
}
