import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Livraison" };

export default function Page() {
  return (
    <ComingSoon
      title="Livraison"
      description="La modification des tarifs Anderson et des délais par wilaya arrive à la prochaine étape."
    />
  );
}
