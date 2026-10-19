import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function Page() {
  return (
    <ComingSoon
      title="Tableau de bord"
      description="Le résumé de l'activité (commandes du jour, chiffre d'affaires, produits les plus vendus) arrive à la prochaine étape."
    />
  );
}
