import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { authSansFont } from "@/lib/fonts";

// The login, forgot password and new password pages (design/admin-login.png).
//
// Computers: the design is drawn at 1536 × 1024. Every size and position below is written in
// design pixels times `--u` = min(100vw / 1536, 100svh / 1024), so the page keeps the design's
// proportions at any window size and always fits without scrolling (the "stage" is 1024u high,
// centred). Small texts keep a minimum size in px.
//
// Phones and tablets: the photo becomes a band above the card, the card takes the full width.

const CUSTOM_PHOTO = "/images/admin/login-bg.jpg";
const hasCustomPhoto = existsSync(path.join(process.cwd(), "public", CUSTOM_PHOTO));

const MODEL = "/images/collection/collection-hero.jpg";
const CONCRETE = "/images/about/about-values.jpg";

/**
 * The background. With images/admin/login-bg.jpg (framed like the design: the model in the
 * left-centre), the photo simply covers the page. Otherwise, on computers, a dark concrete
 * backdrop (about-values, no person) and the model of collection-hero (1672 × 941, head at
 * 61 % across and 18 % down) placed like the design: head 200u wide, centred at 530u from the
 * left and 390u from the top of the stage, edges fading into the backdrop. Phones and tablets
 * show collection-hero as a band.
 */
function Photo() {
  if (hasCustomPhoto) {
    return (
      <Image
        src={CUSTOM_PHOTO}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[40%_25%]"
      />
    );
  }
  return (
    <>
      <Image
        src={MODEL}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[64%_18%] lg:hidden"
      />
      <Image
        src={CONCRETE}
        alt=""
        fill
        sizes="100vw"
        className="hidden object-cover opacity-45 sepia-[0.5] lg:block"
      />
      {/* 1194u × 672u, left -202u, top 269u of the stage (centred vertically). */}
      <div
        aria-hidden="true"
        className="absolute top-[calc(50svh-243*var(--u))] left-[calc(-202*var(--u))] hidden h-[calc(672*var(--u))] w-[calc(1194*var(--u))] mask-t-from-90% mask-r-from-75% mask-b-from-70% mask-l-from-65% lg:block"
      >
        <Image src={MODEL} alt="" fill priority sizes="80vw" className="object-cover" />
      </div>
    </>
  );
}

/** Small uppercase line with a rule: "01 ——", "RASSM ——". */
function RuledLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-[calc(14*var(--u,1px))] font-auth text-[max(10px,calc(11*var(--u,1px)))] tracking-[0.22em] text-paper/80 uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  longTitle = false,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  /** Smaller title for the two-line ones ("Mot de passe oublié", "Nouveau mot de passe"). */
  longTitle?: boolean;
}) {
  return (
    <div
      className={cn(
        authSansFont.variable,
        "min-h-svh bg-onyx text-ink lg:relative lg:flex lg:flex-col lg:justify-center lg:overflow-x-clip lg:[--u:min(calc(100vw/1536),calc(100svh/1024))]",
      )}
    >
      {/* Photo: a band on phones and tablets, the whole page on computers. */}
      <div className="relative h-64 overflow-hidden sm:h-80 lg:absolute lg:inset-0 lg:h-auto">
        <Photo />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-onyx via-onyx/35 to-onyx/20 lg:bg-linear-to-r lg:from-onyx/75 lg:via-onyx/10 lg:to-onyx/40"
        />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-7 text-paper sm:px-10 lg:hidden">
          <p className="font-display text-[2.6rem] leading-none tracking-[0.16em] sm:text-5xl">
            RASSM
          </p>
          <p className="mt-2.5 font-auth text-[10px] tracking-[0.25em] text-mist uppercase">
            Espace administrateur
          </p>
        </div>
      </div>

      {/* The stage: at least 1024u high, centred; it grows (and the page scrolls) only if a card
          is ever taller than the window. */}
      <div
        className={cn(
          "lg:relative lg:min-h-[calc(1024*var(--u))]",
          longTitle ? "lg:pt-[calc(80*var(--u))]" : "lg:pt-[calc(101*var(--u))]",
        )}
      >
        <RuledLabel className="absolute top-[calc(38*var(--u))] right-[calc(54*var(--u))] hidden lg:flex">
          RASSM <span aria-hidden="true" className="h-px w-[calc(34*var(--u))] bg-paper/60" />
        </RuledLabel>

        {/* Brand column (computers only). */}
        <div className="absolute top-[calc(76*var(--u))] left-[calc(113*var(--u))] hidden text-paper lg:block">
          <RuledLabel>
            01 <span aria-hidden="true" className="h-px w-[calc(70*var(--u))] bg-paper/50" />
          </RuledLabel>
          <p className="mt-[calc(110*var(--u))] font-display text-[calc(76*var(--u))] leading-none font-normal tracking-[0.13em]">
            RASSM
          </p>
          <p className="mt-[calc(2*var(--u))] max-w-[calc(330*var(--u))] font-auth text-[max(10px,calc(12*var(--u)))] leading-[1.7] tracking-[0.26em] text-paper/90 uppercase xl:max-w-none">
            Dessiner ce qu&apos;on ne peut pas dire.
          </p>
          <span
            aria-hidden="true"
            className="mt-[calc(54*var(--u))] block h-[calc(50*var(--u))] w-px bg-paper/60"
          />
          <p className="mt-[calc(26*var(--u))] font-auth text-[max(10px,calc(11.5*var(--u)))] leading-[2] tracking-[0.13em] text-mist/90 uppercase">
            Espace administrateur
            <br />
            Gérez votre boutique
            <br />
            Produits, commandes,
            <br />
            clients et bien plus.
          </p>
        </div>

        {/* The card. */}
        <main className="relative flex w-full flex-col lg:mr-[calc(94*var(--u))] lg:ml-auto lg:w-[calc(594*var(--u))] lg:border lg:border-paper/60">
          <div className="bg-bone px-6 pt-9 pb-10 sm:px-12 sm:pt-12 lg:pt-[calc(49*var(--u))] lg:pr-[calc(70*var(--u))] lg:pb-[calc(42*var(--u))] lg:pl-[calc(74*var(--u))]">
            <div className="mx-auto max-w-lg lg:max-w-none">
              <p className="inline-block border-b border-ink/30 pb-[calc(7*var(--u,1px))] font-auth text-[max(9px,calc(11*var(--u,1px)))] tracking-[0.3em] text-stone uppercase">
                Admin
              </p>
              <h1
                className={cn(
                  "mt-[calc(22*var(--u,1px))] font-display leading-[1.05] font-medium tracking-[0.06em] text-balance uppercase",
                  longTitle
                    ? "text-[max(1.9rem,calc(42*var(--u,1px)))]"
                    : "text-[max(2.1rem,calc(56*var(--u,1px)))]",
                )}
              >
                {title}
              </h1>
              <div className="mt-[calc(10*var(--u,1px))] font-auth text-[max(11.5px,calc(13.5*var(--u,1px)))] leading-[1.7] font-light tracking-[0.02em] text-stone">
                {subtitle}
              </div>
              <div className="mt-[calc(44*var(--u,1px))]">{children}</div>
            </div>
          </div>
          <AuthCardFooter />
        </main>
      </div>
    </div>
  );
}

/** Black block under the card: brand on the left, the dashboard sections (not links). */
function AuthCardFooter() {
  return (
    <div className="bg-onyx px-6 py-9 text-paper sm:px-12 lg:h-[calc(211*var(--u))] lg:py-0 lg:pr-[calc(70*var(--u))] lg:pl-[calc(74*var(--u))]">
      <div className="mx-auto flex h-full max-w-lg items-center justify-between gap-6 lg:grid lg:max-w-none lg:grid-cols-[calc(275*var(--u))_1fr] lg:gap-0">
        <div className="lg:self-start lg:pt-[calc(66*var(--u))]">
          <span aria-hidden="true" className="block h-px w-[calc(58*var(--u,1px))] bg-paper/70" />
          <p className="mt-[calc(34*var(--u,1px))] font-display text-[max(1.35rem,calc(28*var(--u,1px)))] leading-none tracking-[0.12em]">
            RASSM
          </p>
          <p className="mt-[calc(10*var(--u,1px))] font-auth text-[max(9.5px,calc(10.5*var(--u,1px)))] tracking-[0.2em] text-mist uppercase">
            Administration
          </p>
        </div>
        <ul
          aria-hidden="true"
          className="space-y-[calc(9*var(--u,1px))] border-l border-paper/25 py-[calc(8*var(--u,1px))] pl-8 font-auth text-[max(9.5px,calc(10.5*var(--u,1px)))] tracking-[0.18em] text-mist uppercase sm:pl-14 lg:h-[calc(100*var(--u))] lg:py-[calc(6*var(--u))] lg:pl-[calc(60*var(--u))]"
        >
          <li>Produits</li>
          <li>Commandes</li>
          <li>Clients</li>
          <li>Paramètres</li>
        </ul>
      </div>
    </div>
  );
}
