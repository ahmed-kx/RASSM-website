import { SIZE_GUIDE_ROWS } from "@/content/size-guide";
import { cn } from "@/lib/cn";

/** Size table (cm, measured flat), shared by the product page dialog and /guide-des-tailles. */
export function SizeGuideTable({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Mesures par taille, en centimètres, prises à plat</caption>
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
  );
}
