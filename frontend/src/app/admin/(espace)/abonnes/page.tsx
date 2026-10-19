import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Abonnés" };

export default function Page() {
  return (
    <ComingSoon
      title="Abonnés"
      description="La liste des inscrits à la newsletter et leur export arrivent à la prochaine étape."
    />
  );
}
