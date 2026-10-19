import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Large uppercase display serif heading, e.g. "Portez votre silence." */
export function SectionTitle({
  as: Tag = "h2",
  id,
  children,
  className,
}: {
  as?: "h1" | "h2" | "h3";
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "font-display text-[2.5rem] leading-[0.95] font-medium uppercase md:text-5xl lg:text-[3.5rem]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
