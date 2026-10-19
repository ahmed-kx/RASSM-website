import Image from "next/image";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/cn";

/**
 * Customer info pages (Livraison, Échanges, Guide des tailles, FAQ): dark band over a
 * concrete photo under the transparent header, then the content on bone at reading width.
 */
export function InfoPage({
  label,
  title,
  intro,
  children,
}: {
  label: string;
  title: ReactNode;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-onyx text-paper">
        <Image
          src="/images/about/about-values.jpg"
          alt=""
          fill
          preload
          sizes="100vw"
          className="-z-20 object-cover object-[70%_50%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-r from-onyx/95 via-onyx/85 to-onyx/65"
        />
        <Container className="pt-28 pb-10 md:pt-32 md:pb-12 lg:pt-36 lg:pb-14">
          <SectionLabel className="text-mist">{label}</SectionLabel>
          <SectionTitle as="h1" className="mt-4 max-w-3xl">
            {title}
          </SectionTitle>
          <div className="mt-5 max-w-2xl space-y-3 text-[15px] leading-relaxed text-mist md:text-base">
            {intro}
          </div>
        </Container>
      </section>
      <div className="bg-bone">
        <Container className="py-12 md:py-14 lg:py-16">
          <div className="mx-auto max-w-3xl space-y-14 md:space-y-16">{children}</div>
        </Container>
      </div>
    </>
  );
}

/** One titled block of an info page. */
export function InfoSection({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <h2
        id={id}
        className="font-display text-[1.85rem] leading-none font-medium uppercase md:text-[2.2rem]"
      >
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Body copy of an info page: comfortable line length and spacing. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-4 text-[15px] leading-relaxed text-ash md:text-base", className)}>
      {children}
    </div>
  );
}

/** Short numbered steps: large display numbers, a bold title and one or two lines of text. */
export function NumberedSteps({
  steps,
}: {
  steps: readonly { title: ReactNode; text: ReactNode }[];
}) {
  return (
    <ol className="divide-y divide-line border-y border-line">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-5 py-6 md:gap-8">
          <span
            aria-hidden="true"
            className="w-10 shrink-0 font-display text-[2.5rem] leading-none font-medium text-stone tabular-nums md:w-14 md:text-5xl"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-button text-ink uppercase">
              {step.title}
            </h3>
            <div className="mt-2 text-[15px] leading-relaxed text-ash">{step.text}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Light note box, e.g. the hint for the new wilayas. */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-2 border-ink bg-cream/60 px-5 py-4 text-[15px] leading-relaxed text-ash">
      {children}
    </div>
  );
}

/** Inline text link inside body copy. */
export const proseLink =
  "text-ink underline underline-offset-4 decoration-1 hover:decoration-2 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current";
