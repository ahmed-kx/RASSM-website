"use client";

import { formatDeliveryDelay, formatPrice } from "@rassm/shared";
import { useId, useState } from "react";
import { inputClasses } from "@/components/ui/form-field";
import { CloseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { DeliveryRate } from "@/lib/data/delivery";
import { matchesSearch } from "@/lib/search-text";

const code = (rate: DeliveryRate) => String(rate.wilayaCode).padStart(2, "0");
const stopDesk = (rate: DeliveryRate) =>
  rate.stopDeskPrice === null ? "Non disponible" : formatPrice(rate.stopDeskPrice);

/** Delivery rates of the 58 wilayas, filterable by name or code (accent-insensitive). */
export function DeliveryRates({ rates }: { rates: readonly DeliveryRate[] }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const listId = useId();
  const visible = rates.filter((rate) => matchesSearch(`${code(rate)} ${rate.wilayaName}`, query));

  return (
    <div>
      <label htmlFor={inputId} className="text-[11px] font-semibold tracking-label uppercase">
        Rechercher votre wilaya
      </label>
      <div className="relative mt-2">
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex. : Béjaïa, Oran, 16…"
          autoComplete="off"
          aria-controls={listId}
          className={cn(inputClasses, "pr-12 [&::-webkit-search-cancel-button]:hidden")}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Effacer la recherche"
            className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center text-ash hover:text-ink"
          >
            <CloseIcon width={16} height={16} />
          </button>
        )}
      </div>
      <p role="status" className="mt-3 text-[13px] text-stone">
        {query.trim() === ""
          ? `${rates.length} wilayas, départ Alger.`
          : visible.length === 0
            ? `Aucune wilaya ne correspond à « ${query.trim()} ».`
            : `${visible.length} wilaya${visible.length > 1 ? "s" : ""} trouvée${visible.length > 1 ? "s" : ""}.`}
      </p>

      <div id={listId} className="mt-4">
        {/* Phones: one card per wilaya. */}
        <ul className="divide-y divide-line border-y border-line md:hidden">
          {visible.map((rate) => (
            <li key={rate.wilayaCode} className="py-4">
              <p className="flex items-baseline justify-between gap-4">
                <span className="font-semibold text-ink">
                  <span className="mr-2 text-stone tabular-nums">{code(rate)}</span>
                  {rate.wilayaName}
                </span>
                <span className="shrink-0 text-[13px] text-ash">
                  {formatDeliveryDelay(rate.estimatedDays)}
                </span>
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="text-stone">À domicile</dt>
                  <dd className="text-ink tabular-nums">{formatPrice(rate.homePrice)}</dd>
                </div>
                <div>
                  <dt className="text-stone">Au bureau (stop desk)</dt>
                  <dd
                    className={cn(
                      "tabular-nums",
                      rate.stopDeskPrice === null ? "text-stone italic" : "text-ink",
                    )}
                  >
                    {stopDesk(rate)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        {/* Tablets and computers: a table. */}
        <table className="hidden w-full text-left text-sm md:table">
          <caption className="sr-only">
            Tarifs et délais de livraison par wilaya, départ Alger
          </caption>
          <thead>
            <tr className="border-b border-ink text-[10px] tracking-label uppercase">
              <th scope="col" className="py-3 pr-4 font-semibold">
                Wilaya
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">
                Délai estimé
              </th>
              <th scope="col" className="py-3 pr-4 text-right font-semibold">
                À domicile
              </th>
              <th scope="col" className="py-3 text-right font-semibold">
                Au bureau (stop desk)
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {visible.map((rate) => (
              <tr key={rate.wilayaCode} className="border-b border-line">
                <th scope="row" className="py-3 pr-4 font-normal text-ink">
                  <span className="mr-3 text-stone">{code(rate)}</span>
                  {rate.wilayaName}
                </th>
                <td className="py-3 pr-4 text-ash">{formatDeliveryDelay(rate.estimatedDays)}</td>
                <td className="py-3 pr-4 text-right text-ink">{formatPrice(rate.homePrice)}</td>
                <td
                  className={cn(
                    "py-3 text-right",
                    rate.stopDeskPrice === null ? "text-stone italic" : "text-ink",
                  )}
                >
                  {stopDesk(rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
