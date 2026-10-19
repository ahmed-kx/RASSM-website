// Meta Pixel (Facebook ads). Loaded only when NEXT_PUBLIC_META_PIXEL_ID is set;
// otherwise every function here does nothing and no Meta script is requested.

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
const SCRIPT_URL = "https://connect.facebook.net/en_US/fbevents.js";

/** Prices are sent in Algerian dinars. */
export const PIXEL_CURRENCY = "DZD";

export type MetaStandardEvent = "PageView" | "ViewContent" | "InitiateCheckout" | "Purchase";

interface Fbq {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
}

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export function isMetaPixelEnabled(): boolean {
  return PIXEL_ID !== "";
}

/** The official Pixel snippet: a queue that fbevents.js replays once it has loaded. */
function getFbq(): Fbq | undefined {
  if (!isMetaPixelEnabled() || typeof window === "undefined") return undefined;
  if (window.fbq) return window.fbq;

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq ??= fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = SCRIPT_URL;
  document.head.appendChild(script);

  fbq("init", PIXEL_ID);
  return fbq;
}

// React runs effects twice in development (Strict Mode): the same event for the same
// page within a moment is sent once.
const recentEvents = new Map<string, number>();

/**
 * Sends a standard event. `dedupeKey` drops an identical call made right after;
 * `eventID` lets Meta deduplicate with server events later (Conversions API).
 */
export function trackMetaEvent(
  event: MetaStandardEvent,
  params?: Record<string, unknown>,
  options: { dedupeKey?: string; eventID?: string } = {},
): void {
  const fbq = getFbq();
  if (!fbq) return;
  if (options.dedupeKey) {
    const key = `${event}:${options.dedupeKey}`;
    const now = Date.now();
    const last = recentEvents.get(key);
    if (last !== undefined && now - last < 1000) return;
    recentEvents.set(key, now);
  }
  if (options.eventID) fbq("track", event, params ?? {}, { eventID: options.eventID });
  else if (params) fbq("track", event, params);
  else fbq("track", event);
}

const PURCHASE_PREFIX = "rassm-pixel-purchase:";
const purchasesSent = new Set<string>();

/** Purchase, sent once per order even if the thank-you page is reloaded. */
export function trackPurchaseOnce(orderNumber: string, params: Record<string, unknown>): void {
  if (!isMetaPixelEnabled()) return;
  let alreadySent = purchasesSent.has(orderNumber);
  try {
    alreadySent ||= localStorage.getItem(PURCHASE_PREFIX + orderNumber) !== null;
    localStorage.setItem(PURCHASE_PREFIX + orderNumber, "1");
  } catch {
    // Storage blocked: the in-memory set still prevents doubles in this tab.
  }
  purchasesSent.add(orderNumber);
  if (!alreadySent) trackMetaEvent("Purchase", params, { eventID: orderNumber });
}
