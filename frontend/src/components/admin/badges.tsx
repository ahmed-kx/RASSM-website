import {
  ORDER_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
  type AdminOrder,
  type OrderStatus,
  type ProductStatus,
} from "@rassm/shared";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Soft pills of the dashboard (design/admin-orders.png): status colors, then the flags.

type Tone =
  "sand" | "success" | "info" | "danger" | "rose" | "warning" | "ink" | "alert" | "neutral";

const TONES: Record<Tone, string> = {
  sand: "bg-sand text-ash",
  success: "bg-success/12 text-success",
  info: "bg-info/12 text-info",
  danger: "bg-error/10 text-error",
  rose: "bg-rose/10 text-rose",
  warning: "bg-warning/12 text-warning",
  ink: "bg-ink text-paper",
  alert: "bg-error text-paper",
  neutral: "bg-cream text-ash",
};

const SIZES = {
  /** Flags ("Nouveau", "Liste noire"): small spaced capitals. */
  sm: "px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
} as const;

export function Pill({
  tone,
  size = "md",
  children,
  title,
  className,
}: {
  tone: Tone;
  size?: keyof typeof SIZES;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-sm leading-none whitespace-nowrap",
        SIZES[size],
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: "sand",
  confirmed: "success",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
  returned: "rose",
};

/** In the dashboard a pending order is "Nouvelle" (customers see "Reçue"). */
export const ADMIN_STATUS_LABELS: Record<OrderStatus, string> = {
  ...ORDER_STATUS_LABELS,
  pending: "Nouvelle",
};

export function StatusBadge({
  status,
  size,
  className,
}: {
  status: OrderStatus;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <Pill tone={STATUS_TONE[status]} size={size} className={className}>
      {ADMIN_STATUS_LABELS[status]}
    </Pill>
  );
}

/** "Nouveau", "Liste noire" (red), "Suspecte" (ochre) and "Test" (grey) flags of an order. */
export function OrderFlags({
  order,
  withReasons = false,
  showNew = true,
}: {
  order: AdminOrder;
  withReasons?: boolean;
  showNew?: boolean;
}) {
  const isNew = showNew && order.openedAt === null && order.status === "pending";
  if (!isNew && !order.suspicious && !order.blacklist && !order.test) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {isNew && (
        <Pill tone="ink" size="sm">
          Nouveau
        </Pill>
      )}
      {order.blacklist && (
        <Pill tone="alert" size="sm" title={order.blacklist.reason}>
          Liste noire{withReasons ? ` : ${order.blacklist.reason}` : ""}
        </Pill>
      )}
      {order.test && (
        <Pill
          tone="neutral"
          size="sm"
          title="Commande de test : jamais envoyée à Meta comme confirmée"
        >
          Test
        </Pill>
      )}
      {order.suspicious && (
        <Pill tone="warning" size="sm" title={order.suspiciousReason ?? undefined}>
          Suspecte{withReasons && order.suspiciousReason ? ` : ${order.suspiciousReason}` : ""}
        </Pill>
      )}
    </span>
  );
}

const PRODUCT_TONE: Record<ProductStatus, Tone> = {
  active: "success",
  low: "warning",
  out: "danger",
  hidden: "sand",
};

/** Actif (green), Stock faible (ochre), Rupture (red), Masqué (beige). */
export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Pill tone={PRODUCT_TONE[status]}>{PRODUCT_STATUS_LABELS[status]}</Pill>;
}

/** Units left with a colored dot: green ok, ochre low (total at or below the threshold), red none. */
export function StockLevel({ units, level }: { units: number; level: "ok" | "low" | "out" }) {
  const color = level === "ok" ? "text-success" : level === "low" ? "text-warning" : "text-error";
  const dot = level === "ok" ? "bg-success" : level === "low" ? "bg-warning" : "bg-error";
  const label = level === "ok" ? "Stock suffisant" : level === "low" ? "Stock faible" : "Rupture";
  return (
    <span className={cn("inline-flex items-center gap-2 tabular-nums", color)} title={label}>
      <span aria-hidden="true" className={cn("size-2.5 rounded-full", dot)} />
      {units}
      <span className="sr-only"> ({label})</span>
    </span>
  );
}
