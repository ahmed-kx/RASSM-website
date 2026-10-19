"use client";

import { useStore } from "@tanstack/react-form";
import { ProductGallery } from "../product-gallery";
import { useProductOrder } from "./product-order-provider";

const VIEWS = ["face", "dos"] as const;

/** The gallery of the product page: shows the selected color's photos when it has its own. */
export function ProductOrderGallery() {
  const { form, product } = useProductOrder();
  const colorName = useStore(form.store, (state) => state.values.color);
  const color = product.colors.find((candidate) => candidate.name === colorName);
  const images = color?.images?.length ? color.images : product.images;
  const colorLabel = (color ?? product.colors[0])?.name.toLowerCase();

  return (
    <ProductGallery
      // A new photo set starts again on its first photo.
      key={images.join("|")}
      images={images.map((src, i) => ({
        src,
        alt: `${product.name}${colorLabel ? ` ${colorLabel}` : ""}, vue de ${VIEWS[i] ?? "détail"}`,
      }))}
    />
  );
}
