import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Produits" };

export default function Page() {
  return (
    <ComingSoon
      title="Produits"
      description="L'ajout et la modification des produits, des photos, du stock par couleur et taille et des réductions sur la livraison arrivent à la prochaine étape."
    />
  );
}
