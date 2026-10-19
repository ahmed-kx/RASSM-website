import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Large uppercase display serif heading, e.g. "Wear your silence." */
export function SectionTitle({
  as: Tag = "h2",
  id,
  lang,
  children,
  className,
}: {
  as?: "h1" | "h2" | "h3";
  id?: string;
  /** Set to "en" for English slogans, so screen readers pronounce them correctly. */
  lang?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      id={id}
      lang={lang}
      className={cn(
        "font-display text-[2.5rem] leading-[0.95] font-medium uppercase md:text-5xl lg:text-[3.5rem]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
