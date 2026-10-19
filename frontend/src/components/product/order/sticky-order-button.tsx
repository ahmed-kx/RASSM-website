"use client";

import { formatPrice } from "@rassm/shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ORDER_FORM_ID, useProductOrder } from "./product-order-provider";

/**
 * Mobile only: "Commander maintenant" fixed at the bottom of the screen, scrolling to the
 * order form. Hidden once the form is on screen or above it.
 */
export function StickyOrderButton() {
  const { product } = useProductOrder();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const section = document.getElementById(ORDER_FORM_ID);
    if (!section) return;
    const update = () => {
      setVisible(section.getBoundingClientRect().top > window.innerHeight - 80);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollToForm = () => {
    const section = document.getElementById(ORDER_FORM_ID);
    if (!section) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bone/95 px-4 py-3 backdrop-blur transition-transform duration-300 motion-reduce:transition-none lg:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="flex items-center gap-4">
        <p className="shrink-0 text-sm tabular-nums">{formatPrice(product.price)}</p>
        <Button surface="light" withArrow onClick={scrollToForm} className="flex-1">
          Commander maintenant
        </Button>
      </div>
    </div>
  );
}
