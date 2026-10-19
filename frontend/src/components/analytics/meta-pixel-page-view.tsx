"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackMetaEvent } from "@/lib/analytics/meta-pixel";

/** PageView on the first load and on every client-side navigation. Renders nothing. */
export function MetaPixelPageView() {
  const pathname = usePathname();

  useEffect(() => {
    trackMetaEvent("PageView", undefined, { dedupeKey: pathname });
  }, [pathname]);

  return null;
}
