import { ORDER_STATUS_LABELS, type AdminOrder, type OrderStatus } from "@rassm/shared";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const base =
  "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase";

export function Badge({
  tone,
  children,
  title,
}: {
  tone: "new" | "warning" | "danger" | "muted" | "dark";
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        base,
        tone === "new" && "bg-ink text-paper",
        tone === "warning" && "bg-warning/12 text-warning ring-1 ring-warning/40 ring-inset",
        tone === "danger" && "bg-error text-paper",
        tone === "muted" && "bg-cream text-ash",
        tone === "dark" && "bg-graphite text-paper",
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<OrderStatus, "new" | "muted" | "dark" | "danger"> = {
  pending: "new",
  confirmed: "dark",
  shipped: "dark",
  delivered: "muted",
  cancelled: "muted",
  returned: "muted",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

/** "Nouveau", "Suspecte", "Liste noire" badges of an order. */
export function OrderFlags({
  order,
  withReasons = false,
}: {
  order: AdminOrder;
  withReasons?: boolean;
}) {
  const isNew = order.openedAt === null && order.status === "pending";
  if (!isNew && !order.suspicious && !order.blacklist) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {isNew && <Badge tone="new">Nouveau</Badge>}
      {order.blacklist && (
        <Badge tone="danger" title={order.blacklist.reason}>
          Liste noire{withReasons ? ` : ${order.blacklist.reason}` : ""}
        </Badge>
      )}
      {order.suspicious && (
        <Badge tone="warning" title={order.suspiciousReason ?? undefined}>
          Suspecte{withReasons && order.suspiciousReason ? ` : ${order.suspiciousReason}` : ""}
        </Badge>
      )}
    </span>
  );
}
