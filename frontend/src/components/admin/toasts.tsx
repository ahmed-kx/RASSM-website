"use client";

import Link from "next/link";
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export interface Toast {
  id: number;
  title: string;
  message?: string;
  tone?: "default" | "error" | "success";
  href?: string;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, "id">) => void;
  /** Removes every toast (e.g. the notification panel already shows the same orders). */
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = use(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>.");
  return value;
}

const DURATION_MS = 7000;

/** Short messages under the top bar (above the content, reachable on a phone). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const dismissAll = useCallback(() => setToasts([]), []);

  const value = useMemo(() => ({ showToast, dismissAll }), [showToast, dismissAll]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-14 z-50 flex flex-col items-center gap-2 p-3 lg:top-16 lg:items-end lg:p-5"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 border px-4 py-3 shadow-lg motion-safe:animate-fade-in",
              toast.tone === "error"
                ? "border-error bg-paper text-error"
                : "border-ink bg-ink text-paper",
            )}
          >
            <div className="min-w-0 flex-1 text-sm">
              {toast.href ? (
                <Link href={toast.href} onClick={() => dismiss(toast.id)} className="block">
                  <p className="font-semibold">{toast.title}</p>
                  {toast.message && <p className="mt-0.5 opacity-80">{toast.message}</p>}
                </Link>
              ) : (
                <>
                  <p className="font-semibold">{toast.title}</p>
                  {toast.message && <p className="mt-0.5 opacity-80">{toast.message}</p>}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Fermer"
              className="-mt-1 -mr-2 grid size-8 shrink-0 place-items-center opacity-70 hover:opacity-100"
            >
              <CloseIcon width={16} height={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
