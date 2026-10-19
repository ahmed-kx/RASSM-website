"use client";

import Link from "next/link";
import { useRef } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { SIZE_GUIDE_FIT } from "@/content/size-guide";
import { routes } from "@/lib/routes";
import { SizeGuideTable } from "./size-guide-table";

/** "Guide des tailles" link opening a modal with the size table (native <dialog>). */
export function SizeGuideDialog() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className="text-xs text-ash underline underline-offset-4 hover:text-ink"
      >
        Guide des tailles
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="size-guide-title"
        // Click on the backdrop closes the dialog.
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg bg-bone p-0 text-ink backdrop:bg-ink/50"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2 id="size-guide-title" className="font-display text-3xl uppercase">
              Guide des tailles
            </h2>
            <button
              type="button"
              aria-label="Fermer le guide des tailles"
              onClick={() => dialog.current?.close()}
              className="-mt-1 -mr-2 grid size-10 place-items-center hover:opacity-70"
            >
              <CloseIcon />
            </button>
          </div>
          <p className="mt-3 text-sm text-ash">{SIZE_GUIDE_FIT}</p>
          <SizeGuideTable className="mt-6" />
          <Link
            href={routes.sizeGuide}
            className="mt-5 inline-block text-xs text-ash underline underline-offset-4 hover:text-ink"
          >
            Comment prendre vos mesures
          </Link>
        </div>
      </dialog>
    </>
  );
}
