import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const MAX_WIDTH = {
  /** Homepage: almost full width. */
  wide: "max-w-[1440px]",
  /** Shop pages (collection, product): wider side margins, as in design/Collection.png. */
  narrow: "max-w-[1320px]",
} as const;

/** Page-width wrapper: 16px gutter on mobile, centred, capped width. */
export function Container({
  children,
  size = "wide",
  className,
}: {
  children: ReactNode;
  size?: keyof typeof MAX_WIDTH;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-12", MAX_WIDTH[size], className)}>
      {children}
    </div>
  );
}
