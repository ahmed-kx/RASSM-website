import Link from "next/link";
import { adminRoutes } from "@/lib/admin/routes";
import { AdminPageTitle } from "./admin-shell";

/** Placeholder for the dashboard sections built in the next step. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <AdminPageTitle title={title} />
      <div className="mt-8 border border-line bg-paper p-6 sm:p-8">
        <p className="text-[11px] font-semibold tracking-label text-stone uppercase">
          Bientôt disponible
        </p>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ash">{description}</p>
        <Link
          href={adminRoutes.orders}
          className="mt-6 inline-flex min-h-11 items-center border border-ink px-5 text-[11px] font-semibold tracking-button uppercase hover:bg-ink hover:text-paper"
        >
          Voir les commandes
        </Link>
      </div>
    </>
  );
}
