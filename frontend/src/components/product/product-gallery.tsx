"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface GalleryImage {
  src: string;
  alt: string;
}

/**
 * Main photo + thumbnails. The main area is a scroll-snap strip, so it swipes on
 * touch screens; thumbnails scroll it to the chosen photo.
 */
export function ProductGallery({ images }: { images: readonly GalleryImage[] }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const goTo = (target: number) => {
    const element = track.current;
    if (!element) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: target * element.clientWidth, behavior: smooth ? "smooth" : "auto" });
    setIndex(target);
  };

  return (
    <div>
      <div
        ref={track}
        onScroll={(event) => {
          const element = event.currentTarget;
          setIndex(Math.round(element.scrollLeft / Math.max(element.clientWidth, 1)));
        }}
        aria-label="Photos du produit"
        className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto bg-cream [&::-webkit-scrollbar]:hidden"
      >
        {images.map((image, i) => (
          <div key={image.src} className="relative aspect-square w-full shrink-0 snap-center">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              preload={i === 0}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-3">
          {images.map((image, i) => (
            <button
              key={image.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Voir la photo ${i + 1} : ${image.alt}`}
              aria-current={i === index}
              className={cn(
                "relative size-20 overflow-hidden border bg-cream transition-colors focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink md:size-24",
                i === index ? "border-ink" : "border-transparent hover:border-ink/40",
              )}
            >
              <Image src={image.src} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
