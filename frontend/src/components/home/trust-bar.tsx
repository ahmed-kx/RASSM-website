import type { ComponentType, SVGProps } from "react";
import { Container } from "@/components/ui/container";
import { BoxIcon, ShieldCheckIcon, TruckIcon } from "@/components/ui/icons";

const PROMISES: readonly {
  title: string;
  text: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  {
    title: "Livraison dans les 58 wilayas",
    text: "Partout en Algérie, directement chez vous.",
    Icon: TruckIcon,
  },
  { title: "Paiement à la livraison", text: "Simple. Sûr. Partout en Algérie.", Icon: BoxIcon },
  { title: "Qualité supérieure", text: "Matières et finitions soignées.", Icon: ShieldCheckIcon },
];

export function TrustBar() {
  return (
    <section aria-label="Nos engagements" className="border-y border-line bg-bone">
      <Container>
        <ul className="divide-y divide-line md:grid md:grid-cols-3 md:divide-x md:divide-y-0 md:divide-ink/40 md:py-6">
          {PROMISES.map(({ title, text, Icon }) => (
            <li
              key={title}
              className="flex items-center gap-4 py-5 md:justify-center md:px-4 md:py-1"
            >
              <Icon className="shrink-0 text-ink" />
              <div>
                <h2 className="text-[11px] font-semibold tracking-label uppercase">{title}</h2>
                <p className="mt-1 text-xs text-ash">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
