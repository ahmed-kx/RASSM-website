import Link from "next/link";
import { adminRoutes } from "@/lib/admin/routes";
import { AdminCard, AdminPageHeader, buttonClass } from "./admin-ui";

/** Placeholder for the dashboard sections built in the next step. */
export function ComingSoon({
  title,
  subtitle,
  description,
}: {
  title: string;
  subtitle?: string;
  description: string;
}) {
  return (
    <>
      <AdminPageHeader title={title} subtitle={subtitle} />
      <AdminCard title="Bientôt disponible" className="mt-8">
        <p className="max-w-lg text-[15px] leading-relaxed text-ash">{description}</p>
        <Link href={adminRoutes.orders} className={buttonClass("outline", "mt-6")}>
          Voir les commandes
        </Link>
      </AdminCard>
    </>
  );
}
