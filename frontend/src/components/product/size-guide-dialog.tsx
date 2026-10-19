"use client";

import { useRef } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { SIZE_GUIDE_ROWS } from "@/content/size-guide";

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
          <p className="mt-3 text-sm text-ash">
            Coupe oversize : prenez votre taille habituelle pour un tombé ample, une taille en
            dessous pour une coupe plus ajustée. Mesures en centimètres, prises à plat.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink text-[10px] tracking-label uppercase">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Taille
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Largeur poitrine
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Longueur
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Épaules
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Manches
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {SIZE_GUIDE_ROWS.map((row) => (
                  <tr key={row.size} className="border-b border-line">
                    <th scope="row" className="py-2.5 pr-3 font-semibold">
                      {row.size}
                    </th>
                    <td className="py-2.5 pr-3">{row.chest}</td>
                    <td className="py-2.5 pr-3">{row.length}</td>
                    <td className="py-2.5 pr-3">{row.shoulders}</td>
                    <td className="py-2.5">{row.sleeve}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </dialog>
    </>
  );
}
