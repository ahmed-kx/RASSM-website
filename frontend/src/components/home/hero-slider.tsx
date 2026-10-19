"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { HandQuote } from "@/components/ui/hand-quote";
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "@/components/ui/icons";
import type { HeroSlide } from "@/content/hero-slides";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";

const AUTOPLAY_DELAY_MS = 6000;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

const controlButton =
  "grid size-10 place-items-center text-paper transition-opacity hover:opacity-70 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-paper";

/**
 * Home hero: fading photo slider with fixed brand text on the left.
 * Auto-plays, pauses on hover or keyboard focus, and never auto-plays when the
 * visitor prefers reduced motion.
 */
export function HeroSlider({ slides }: { slides: readonly HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const count = slides.length;
  const autoplay = count > 1 && !reducedMotion && !hovered && !focused && !paused;

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), AUTOPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, index, count]);

  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="RASSM, Drop 001"
      className="relative isolate flex h-svh max-h-[900px] min-h-[640px] overflow-hidden bg-ink text-paper md:h-[88svh] md:max-h-[860px] md:min-h-[600px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(event) => {
        // Pause for keyboard users only: a mouse click on a button must not freeze the slider.
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          aria-hidden={i !== index}
          className={cn(
            "absolute inset-0 -z-20 transition-opacity duration-[1200ms] ease-in-out motion-reduce:transition-none",
            i === index ? "opacity-100" : "opacity-0",
          )}
        >
          <Image
            src={slide.image}
            alt={slide.alt}
            fill
            sizes="100vw"
            preload={i === 0}
            className="object-cover object-(--hero-position-mobile) md:object-(--hero-position-desktop)"
            style={
              {
                "--hero-position-mobile": slide.position.mobile,
                "--hero-position-desktop": slide.position.desktop,
              } as CSSProperties
            }
          />
        </div>
      ))}

      {/* Contrast: dark at the top for the nav, at the bottom (mobile) or left (desktop) for the text. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/55 to-ink/25 md:bg-linear-to-r md:from-ink/85 md:via-ink/45 md:to-ink/5"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-ink/60 to-transparent"
      />

      <div className="mx-auto flex w-full max-w-[1440px] flex-col justify-end px-4 pt-28 pb-24 sm:px-6 md:justify-center md:pb-20 lg:px-12">
        <h1 className="font-display text-[clamp(4.5rem,17vw,9.75rem)] leading-[0.82] font-semibold tracking-[-0.01em]">
          RASSM
        </h1>
        <p className="mt-5 text-[12px] font-semibold tracking-wide-label uppercase md:mt-6 md:ml-[0.35em] md:text-[15px]">
          Dessiner ce qu&apos;on ne peut pas dire.
        </p>
        <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-paper/90 md:mt-8 md:text-base">
          Plus qu&apos;un vêtement.
          <br />
          Une toile pour ce qui vit en vous.
          <br />
          L&apos;art, l&apos;identité et tout ce qu&apos;il y a entre les deux.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button href={routes.collection} variant="filled" surface="dark" withArrow>
            Découvrir le Drop 001
          </Button>
          <Button href={routes.collection} variant="outlined" surface="dark">
            Voir la collection
          </Button>
        </div>
      </div>

      <HandQuote
        lines={["Certaines", "choses", "vivent mieux", "dans l'art."]}
        className="absolute top-[20%] right-[7%] hidden text-[1.7rem] lg:block"
      />

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 pb-6 sm:px-6 md:pb-8 lg:px-12">
            <div className="flex items-center gap-4">
              <p className="flex items-center gap-4 text-[11px] font-semibold tracking-button">
                <span>{twoDigits(index + 1)}</span>
                <span aria-hidden="true" className="h-px w-10 bg-paper/60" />
                <span className="text-paper/70">{twoDigits(count)}</span>
                <span className="sr-only" aria-live={autoplay ? "off" : "polite"}>
                  Photo {index + 1} sur {count}
                </span>
              </p>
              {!reducedMotion && (
                <button
                  type="button"
                  aria-label={paused ? "Reprendre" : "Mettre en pause"}
                  onClick={() => setPaused((value) => !value)}
                  className={cn(controlButton, "size-8")}
                >
                  {paused ? <PlayIcon /> : <PauseIcon />}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Photo précédente"
                onClick={() => go(-1)}
                className={controlButton}
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                aria-label="Photo suivante"
                onClick={() => go(1)}
                className={controlButton}
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
