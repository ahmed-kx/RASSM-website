import { CATEGORY_LABELS, formatDeliveryDiscountTiers, formatPrice } from "@rassm/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartForm } from "@/components/product/add-to-cart-form";
import { ProductCard, productImageAlt } from "@/components/product/product-card";
import { ProductGallery } from "@/components/product/product-gallery";
import { Container } from "@/components/ui/container";
import { BoxIcon, ExchangeIcon, TruckIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/section-label";
import { getProductBySlug, getProducts, getRelatedProducts } from "@/lib/data/products";
import { routes } from "@/lib/routes";

export async function generateStaticParams() {
  return (await getProducts()).map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/collection/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: "Produit introuvable" };

  const description = `${product.name}, ${formatPrice(product.price)}. ${product.description}`;
  const shortDescription =
    description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
  const image = product.images[0];
  return {
    title: product.name,
    description: shortDescription,
    alternates: { canonical: routes.product(product.slug) },
    openGraph: {
      title: `${product.name} | RASSM`,
      description: shortDescription,
      images: image
        ? [{ url: image, width: 1200, height: 1200, alt: productImageAlt(product) }]
        : undefined,
    },
  };
}

const REASSURANCE = [
  { title: "Paiement à la livraison", Icon: BoxIcon },
  { title: "Livraison dans les 58 wilayas", Icon: TruckIcon },
  { title: "Échange possible", Icon: ExchangeIcon },
] as const;

export default async function ProductPage({ params }: PageProps<"/collection/[slug]">) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);
  const views = ["face", "dos"] as const;
  const images = product.images.map((src, i) => ({
    src,
    alt: productImageAlt(product, views[i] ?? "face"),
  }));
  const tiers = formatDeliveryDiscountTiers(product.deliveryDiscountTiers);

  return (
    <Container size="narrow" className="pt-6 pb-16 lg:pt-8 lg:pb-24">
      <nav aria-label="Fil d'Ariane">
        <ol className="flex flex-wrap items-center gap-2 text-[11px] tracking-button text-stone uppercase">
          <li>
            <Link href={routes.collection} className="hover:text-ink">
              Collection
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={routes.category(product.category)} className="hover:text-ink">
              {CATEGORY_LABELS[product.category]}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <ProductGallery images={images} />

        <div className="lg:sticky lg:top-8 lg:self-start">
          <SectionLabel className="text-stone">{product.drop}</SectionLabel>
          <h1 className="mt-3 font-display text-4xl leading-[0.95] font-medium uppercase md:text-5xl">
            {product.name}
          </h1>
          <p className="mt-4 text-lg">{formatPrice(product.price)}</p>

          <div className="mt-6 flex items-center gap-3">
            <p className="flex items-baseline gap-3">
              <span className="text-[11px] font-semibold tracking-label uppercase">Couleur</span>
              <span className="text-sm">
                {product.colors.map((color) => color.name).join(", ")}
              </span>
            </p>
            <ul className="flex gap-2" aria-hidden="true">
              {product.colors.map((color) => (
                <li
                  key={color.name}
                  className="size-4 rounded-full border border-ink/25"
                  // The swatch color comes from the product data.
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </ul>
          </div>

          <AddToCartForm product={product} />

          {tiers && (
            <div className="mt-6 flex gap-3 border border-line bg-paper px-4 py-3">
              <TruckIcon width={22} height={22} className="mt-0.5 shrink-0" />
              <div className="text-[13px]">
                <p className="font-semibold">Livraison réduite sur ce produit</p>
                <p className="mt-1 text-ash">{tiers}</p>
              </div>
            </div>
          )}

          <ul className="mt-6 grid gap-3 border-y border-line py-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {REASSURANCE.map(({ title, Icon }) => (
              <li key={title} className="flex items-center gap-3">
                <Icon width={22} height={22} className="shrink-0" />
                <span className="text-[11px] font-semibold tracking-button uppercase">{title}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <SectionLabel as="h2">Description</SectionLabel>
            <p className="mt-3 text-[15px] leading-relaxed text-ash">{product.description}</p>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="mt-20">
          <SectionLabel as="h2" id="related-title">
            Vous aimerez aussi
          </SectionLabel>
          <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {related.map((item) => (
              <li key={item.id}>
                <ProductCard product={item} imageSizes="(min-width: 1024px) 22vw, 50vw" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
