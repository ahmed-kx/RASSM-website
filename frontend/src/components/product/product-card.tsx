import { formatPrice, type Product } from "@rassm/shared";
import Image from "next/image";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { QuickAdd, type QuickAddProduct } from "./quick-add";

const DEFAULT_SIZES = "(min-width: 1024px) 19vw, (min-width: 768px) 31vw, 50vw";

/** Only what the client-side size picker needs, to keep the page payload small. */
export function toQuickAddProduct(product: Product): QuickAddProduct {
  const { id, name, slug, images, price, stock } = product;
  return { id, name, slug, images, price, stock };
}

export function productImageAlt(product: Product, view: "face" | "dos" = "face"): string {
  const color = product.colors[0]?.name.toLowerCase();
  return `${product.name}${color ? ` ${color}` : ""}, vue de ${view}`;
}

/** Product tile: photo on cream, uppercase name, price and a round "+" button. */
export function ProductCard({
  product,
  imageSizes = DEFAULT_SIZES,
}: {
  product: Product;
  /** `sizes` attribute of the photo, matching the grid it sits in. */
  imageSizes?: string;
}) {
  const image = product.images[0];

  return (
    <article className="group relative flex h-full flex-col bg-cream">
      <div className="relative aspect-[5/4] overflow-hidden">
        {image && (
          <Image
            src={image}
            alt={productImageAlt(product)}
            fill
            sizes={imageSizes}
            // Packshots are square on a cream background: show the whole garment.
            className="object-contain transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex flex-1 items-end justify-between gap-2 px-3 pt-1 pb-3 md:px-4 md:pb-4">
        <div className="min-w-0">
          <h3 className="text-[11px] leading-snug font-medium tracking-[0.07em] text-ink uppercase md:text-xs md:tracking-[0.06em]">
            {/* The ::after makes the whole card clickable; the "+" button sits above it. */}
            <Link
              href={routes.product(product.slug)}
              className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-1 focus-visible:after:outline-ink"
            >
              {product.name}
            </Link>
          </h3>
          <p className="mt-1 text-xs text-ash">{formatPrice(product.price)}</p>
        </div>
        <QuickAdd product={toQuickAddProduct(product)} />
      </div>
    </article>
  );
}

/** List view row: photo, name, price, short description and the "+" button. */
export function ProductListItem({ product }: { product: Product }) {
  const image = product.images[0];

  return (
    <article className="group relative flex gap-4 bg-cream p-3 md:gap-6 md:p-4">
      <div className="relative aspect-square w-28 shrink-0 overflow-hidden md:w-44">
        {image && (
          <Image
            src={image}
            alt={productImageAlt(product)}
            fill
            sizes="(min-width: 768px) 176px, 112px"
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-xs leading-snug font-semibold tracking-[0.08em] text-ink uppercase">
          <Link
            href={routes.product(product.slug)}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-1 focus-visible:after:outline-ink"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-ash">{formatPrice(product.price)}</p>
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ash md:line-clamp-3 md:max-w-xl">
          {product.description}
        </p>
        <div className="mt-auto flex justify-end pt-3">
          <QuickAdd product={toQuickAddProduct(product)} />
        </div>
      </div>
    </article>
  );
}
