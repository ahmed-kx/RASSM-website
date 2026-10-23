"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { captureAdClick, trackMetaEvent } from "@/lib/analytics/meta-pixel";

/**
 * On the first load and on every client-side navigation: keeps the ad click id (?fbclid= →
 * _fbc cookie), then sends PageView. Renders nothing.
 */
export function MetaPixelPageView() {
  const pathname = usePathname();

  useEffect(() => {
    captureAdClick();
    trackMetaEvent("PageView", undefined, { dedupeKey: pathname });
  }, [pathname]);

  return null;
}
