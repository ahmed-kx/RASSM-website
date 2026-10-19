"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";

/**
 * Native <dialog>: a bottom sheet on phones (reachable with the thumb), centred on larger
 * screens. Escape, the close button and a tap on the backdrop close it.
 */
export function AdminDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="mx-0 mt-auto mb-0 max-h-[90svh] w-full max-w-none overflow-y-auto bg-bone p-0 text-ink backdrop:bg-ink/60 motion-safe:animate-slide-in-up sm:m-auto sm:max-w-lg sm:motion-safe:animate-fade-in"
    >
      {open && (
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-2xl leading-tight font-medium uppercase">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center hover:opacity-70"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
