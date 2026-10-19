import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Small uppercase eyebrow with wide letter-spacing, e.g. "LA COLLECTION". */
export function SectionLabel({
  as: Tag = "p",
  id,
  children,
  className,
}: {
  as?: "p" | "h2" | "span";
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn("text-[11px] font-semibold tracking-wide-label uppercase", className)}
    >
      {children}
    </Tag>
  );
}
