import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// The login, forgot password and new password pages (design/admin-login.png): a full-screen
// photo with the brand on the left, the card on the right with its black footer. On phones and
// tablets the photo becomes a band above the card.

/** A dedicated photo when there is one, otherwise the first hero photo of the site. */
const CUSTOM_PHOTO = "/images/admin/login-bg.jpg";
const hasCustomPhoto = existsSync(path.join(process.cwd(), "public", CUSTOM_PHOTO));

function Photo() {
  return hasCustomPhoto ? (
    <Image
      src={CUSTOM_PHOTO}
      alt=""
      fill
      priority
      sizes="100vw"
      className="object-cover grayscale-[35%]"
    />
  ) : (
    // hero-1: the model stands on the right of the photo; on large screens the photo is
    // shifted left so he stands between the brand and the card, as in the design.
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-y-0 -left-[14%] w-[128%] lg:-left-[60%] lg:w-[160%]">
        <Image
          src="/images/hero/hero-1.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 160vw, 128vw"
          className="object-cover object-[62%_12%] lg:object-[50%_0%]"
        />
      </div>
    </div>
  );
}

/** Small uppercase line with a rule: "01 ——", "RASSM ——". */
function RuledLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-4 text-[11px] tracking-label text-paper/80 uppercase",
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
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-onyx text-ink lg:relative lg:flex lg:items-center">
      {/* Photo: a band on phones and tablets, the whole page on computers. */}
      <div className="relative h-64 overflow-hidden sm:h-80 lg:absolute lg:inset-0 lg:h-auto">
        <Photo />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-onyx via-onyx/35 to-onyx/20 lg:bg-linear-to-r lg:from-onyx/80 lg:via-onyx/25 lg:to-onyx/50"
        />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-7 text-paper sm:px-10 lg:hidden">
          <p className="font-display text-[2.6rem] leading-none tracking-[0.16em] sm:text-5xl">
            RASSM
          </p>
          <p className="mt-2.5 text-[10px] tracking-label text-mist uppercase">
            Espace administrateur
          </p>
        </div>
      </div>

      <RuledLabel className="absolute top-[3.5vh] right-[4%] hidden xl:flex">
        RASSM <span aria-hidden="true" className="h-px w-9 bg-paper/60" />
      </RuledLabel>

      <div className="relative mx-auto w-full max-w-[1440px] lg:flex lg:min-h-svh lg:items-stretch lg:justify-between lg:px-[5%] lg:py-[5vh] xl:px-[7%] xl:pt-[7.5vh] 2xl:px-[8%]">
        {/* Brand column (computers only). */}
        <div className="hidden flex-col text-paper lg:flex lg:pr-10">
          <RuledLabel>
            01 <span aria-hidden="true" className="h-px w-16 bg-paper/50" />
          </RuledLabel>
          <div className="mt-[12vh]">
            <p className="font-display text-[4rem] leading-none tracking-[0.14em] xl:text-[5.2rem] 2xl:text-[5.8rem]">
              RASSM
            </p>
            <p className="mt-4 text-xs tracking-label text-paper/85 uppercase">
              Dessiner ce qu&apos;on ne peut pas dire.
            </p>
            <span aria-hidden="true" className="mt-14 block h-12 w-px bg-paper/60" />
            <p className="mt-9 max-w-64 text-xs leading-[2.1] tracking-[0.2em] text-mist uppercase">
              Espace administrateur
              <br />
              Gérez votre boutique
              <br />
              produits, commandes, clients et bien plus.
            </p>
          </div>
        </div>

        {/* The card. */}
        <main className="flex w-full flex-col lg:max-w-[480px] lg:border lg:border-paper/70 xl:max-w-[560px] 2xl:max-w-[595px]">
          <div className="flex-1 bg-bone px-6 pt-9 pb-10 sm:px-12 sm:pt-12 lg:px-[11%] lg:pt-[4.5vh] lg:pb-[4.5vh] 2xl:px-[13%]">
            <div className="mx-auto max-w-lg lg:max-w-none">
              <p className="inline-block border-b border-ink/40 pb-2.5 text-[11px] tracking-wide-label text-ash uppercase">
                Admin
              </p>
              <h1 className="mt-7 font-display text-[2.6rem] leading-none font-medium tracking-[0.12em] uppercase sm:text-5xl lg:mt-[3.5vh] xl:text-[3.25rem]">
                {title}
              </h1>
              <div className="mt-5 text-[15px] leading-relaxed text-ash lg:mt-[2.5vh]">
                {subtitle}
              </div>
              <div className="mt-9 lg:mt-[3.5vh]">{children}</div>
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
    <div className="bg-onyx px-6 py-9 text-paper sm:px-12 lg:px-[11%] lg:py-[3vh] 2xl:px-[13%]">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-6 lg:max-w-none">
        <div>
          <span aria-hidden="true" className="block h-px w-14 bg-paper/70" />
          <p className="mt-9 font-display text-[1.7rem] leading-none tracking-[0.12em] lg:mt-[3vh]">
            RASSM
          </p>
          <p className="mt-2.5 text-[10px] tracking-label text-mist uppercase">Administration</p>
        </div>
        <ul
          aria-hidden="true"
          className="space-y-1.5 border-l border-paper/25 py-1 pl-8 text-[10px] tracking-label text-mist uppercase sm:pl-14"
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
