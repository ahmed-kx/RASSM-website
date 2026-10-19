import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Messages" };

export default function Page() {
  return (
    <ComingSoon
      title="Messages"
      description="Les messages envoyés depuis la page Contact arrivent à la prochaine étape."
    />
  );
}
