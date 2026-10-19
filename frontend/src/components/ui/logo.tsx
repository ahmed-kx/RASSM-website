import Link from "next/link";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";

/** The RASSM wordmark, linking home. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href={routes.home}
      aria-label="RASSM, retour à l'accueil"
      className={cn(
        "font-display text-[1.75rem] leading-none font-semibold tracking-[0.02em] focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current",
        className,
      )}
    >
      RASSM
    </Link>
  );
}
