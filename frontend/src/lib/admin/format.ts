import { DELIVERY_TYPE_LABELS, formatPrice, getWilaya, type AdminOrder } from "@rassm/shared";

// French formatting for the dashboard. Dates are shown in Algeria time.

const TIME_ZONE = "Africa/Algiers";

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const shortDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});

/** "à l'instant", "il y a 5 min", "il y a 3 h", "hier", then "12 oct." */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (seconds > -45) return "à l'instant";
  const minutes = Math.round(seconds / 60);
  if (minutes > -60) return `il y a ${-minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours > -24) return `il y a ${-hours} h`;
  const days = Math.round(hours / 24);
  if (days > -7) return relative.format(days, "day");
  return shortDate.format(new Date(iso));
}

/** "19/10/2026 18:42" (Algeria time). */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso)).replace(",", "");
}

/** "0555123456" → "0555 12 34 56" */
export function formatPhone(phone: string): string {
  return phone.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
}

export function wilayaName(code: number): string {
  return getWilaya(code)?.name ?? String(code);
}

/** "Canvas Hoodie · Anthracite · L · ×1" */
export function orderProductLine(order: Pick<AdminOrder, "item">): string {
  return `${order.item.name} · ${order.item.color} · ${order.item.size} · ×${order.item.quantity}`;
}

export function telLink(phone: string): string {
  return `tel:+213${phone.replace(/^0/, "")}`;
}

/** Confirmation message the team sends on WhatsApp before calling (or instead of). */
export function confirmationMessage(order: AdminOrder): string {
  const firstName = order.fullName.trim().split(/\s+/)[0] ?? "";
  const where =
    order.deliveryType === "home"
      ? `Livraison à domicile : ${order.address}, ${order.commune}, ${wilayaName(order.wilayaCode)}.`
      : `Livraison au bureau Anderson (stop desk) : ${order.commune}, ${wilayaName(order.wilayaCode)}.`;
  return [
    `Bonjour ${firstName}, ici RASSM.`,
    "Nous avons bien reçu votre commande :",
    `${order.item.name}, couleur ${order.item.color}, taille ${order.item.size}, quantité ${order.item.quantity}.`,
    where,
    `Total à payer à la livraison : ${formatPrice(order.total)}.`,
    "Pouvez-vous nous confirmer votre commande ? Merci !",
  ].join("\n");
}

/** WhatsApp chat with the customer, message pre-filled. */
export function customerWhatsAppLink(order: AdminOrder): string {
  return `https://wa.me/213${order.phone.replace(/^0/, "")}?text=${encodeURIComponent(confirmationMessage(order))}`;
}

export function deliveryLabel(order: Pick<AdminOrder, "deliveryType">): string {
  return DELIVERY_TYPE_LABELS[order.deliveryType];
}

const time = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const dayDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Date column of the orders table: { day: "19 oct.", time: "21:26" } (Algeria time). */
export function formatTableDate(iso: string): { day: string; time: string } {
  const date = new Date(iso);
  return { day: shortDate.format(date), time: time.format(date) };
}

/** "Reçue le 19/10/2026 à 21:26" (Algeria time). */
export function formatReceivedAt(iso: string): string {
  const date = new Date(iso);
  return `Reçue le ${dayDate.format(date)} à ${time.format(date)}`;
}

/** First letter of a name, for the round avatars ("Karim" → "K"). */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase("fr") || "?";
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:A|iOS)?\/([\d.]+)/, "Edge"],
  [/OPR\/([\d.]+)/, "Opera"],
  [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
  [/(?:Chrome|CriOS)\/([\d.]+)/, "Chrome"],
  [/(?:Firefox|FxiOS)\/([\d.]+)/, "Firefox"],
  [/Version\/([\d.]+).*Safari/, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/Linux/, "Linux"],
];

/** "Mozilla/5.0 (Windows NT 10.0…) … Chrome/120.0.6099.71 …" → "Chrome 120.0 (Windows)". */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "—";
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent));
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (!browser) return system ?? "Autre navigateur";
  const version = browser[0].exec(userAgent)?.[1]?.split(".").slice(0, 2).join(".");
  return `${browser[1]}${version ? ` ${version}` : ""}${system ? ` (${system})` : ""}`;
}
