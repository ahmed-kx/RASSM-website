"use client";

import { formatPrice, type AdminOrder } from "@rassm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { adminRoutes } from "@/lib/admin/routes";
import { fetchOrderUpdates } from "@/lib/data/admin";
import { useToast } from "./toasts";

// Live dashboard: polls the API every few seconds. A new order shows a toast, plays a
// short sound (can be muted), updates the "Commandes" badge and, when allowed, a browser
// notification while the dashboard is in the background.

const POLL_MS = 5000;
const MUTED_KEY = "rassm-admin-muted";

interface LiveOrdersValue {
  /** Pending orders nobody has opened yet. */
  unopened: number;
  /** Contact messages not read yet (not archived). */
  unreadMessages: number;
  muted: boolean;
  toggleMuted: () => void;
  notificationPermission: NotificationPermission | "unsupported";
  enableNotifications: () => Promise<void>;
}

const LiveOrdersContext = createContext<LiveOrdersValue | null>(null);

export function useLiveOrders(): LiveOrdersValue {
  const value = use(LiveOrdersContext);
  if (!value) throw new Error("useLiveOrders must be used inside <LiveOrdersProvider>.");
  return value;
}

/** Two short soft tones (Web Audio: no file to load). */
function playChime(context: AudioContext) {
  const now = context.currentTime;
  [880, 1320].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const start = now + index * 0.16;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.4);
  });
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function LiveOrdersProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const since = useRef<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);
  const [permission, setPermission] =
    useState<LiveOrdersValue["notificationPermission"]>("unsupported");

  useEffect(() => {
    setMuted(readMuted());
    if ("Notification" in window) setPermission(Notification.permission);
    // Browsers only allow sound after a first tap or click on the page.
    const unlock = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const { data } = useQuery({
    queryKey: ["admin", "updates"],
    queryFn: () => fetchOrderUpdates(since.current),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  // A new contact message (the unread counter went up): a toast and the messages list refresh.
  const lastUnread = useRef<number | null>(null);
  useEffect(() => {
    if (data === undefined) return;
    const previous = lastUnread.current;
    lastUnread.current = data.unreadMessages;
    if (previous === null || data.unreadMessages <= previous) return;
    void queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
    showToast({
      title: "Nouveau message",
      message: "Un message est arrivé depuis la page Contact.",
      href: adminRoutes.messages,
    });
  }, [data, queryClient, showToast]);

  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (!data) return;
    if (since.current === null) {
      // First answer: only sets the starting point (no alert for older orders).
      since.current = data.serverTime;
      return;
    }
    if (data.orders.length === 0) return;
    since.current = data.orders.at(-1)?.createdAt ?? since.current;
    void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    for (const order of data.orders) announce(order);
    if (!mutedRef.current && audio.current) playChime(audio.current);

    function announce(order: AdminOrder) {
      const flags = [order.blacklist && "Liste noire", order.suspicious && "Suspecte"].filter(
        Boolean,
      );
      const message = `${order.fullName} · ${order.item.name} · ${formatPrice(order.total)}${
        flags.length ? ` · ${flags.join(", ")}` : ""
      }`;
      showToast({ title: "Nouvelle commande", message, href: adminRoutes.order(order.id) });
      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        try {
          const notification = new Notification("Nouvelle commande RASSM", {
            body: message,
            tag: order.id,
          });
          notification.onclick = () => {
            window.focus();
            window.location.href = adminRoutes.order(order.id);
          };
        } catch {
          // Some phones only allow notifications from an installed app: the toast is enough.
        }
      }
    }
  }, [data, queryClient, showToast]);

  const value: LiveOrdersValue = {
    unopened: data?.unopened ?? 0,
    unreadMessages: data?.unreadMessages ?? 0,
    muted,
    toggleMuted: () => {
      setMuted((current) => {
        const next = !current;
        try {
          localStorage.setItem(MUTED_KEY, next ? "1" : "0");
        } catch {
          // Storage blocked: the choice lasts for this visit.
        }
        if (!next) {
          audio.current ??= new AudioContext();
          void audio.current.resume().then(() => audio.current && playChime(audio.current));
        }
        return next;
      });
    },
    notificationPermission: permission,
    enableNotifications: async () => {
      if (!("Notification" in window)) return;
      setPermission(await Notification.requestPermission());
    },
  };

  return <LiveOrdersContext value={value}>{children}</LiveOrdersContext>;
}
