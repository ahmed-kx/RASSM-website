import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ArrowRightIcon } from "./icons";

/** Uppercase text link followed by an arrow, e.g. "Voir tout →". */
export function ArrowLink({
  href,
  children,
  underline = false,
  className,
}: {
  href: string;
  children: ReactNode;
  underline?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-3 text-[11px] font-semibold tracking-button uppercase focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current",
        className,
      )}
    >
      <span className={cn(underline && "border-b border-current pb-0.5")}>{children}</span>
      <ArrowRightIcon className="shrink-0 transition-transform duration-200 motion-safe:group-hover:translate-x-1" />
    </Link>
  );
}
