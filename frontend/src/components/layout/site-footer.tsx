import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { Container } from "@/components/ui/container";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { CONTACT } from "@/content/contact";
import { FOOTER_COLUMNS, SOCIAL_LINKS, type SocialNetwork } from "@/content/navigation";
import { NewsletterForm } from "./newsletter-form";

const SOCIAL_ICONS: Record<SocialNetwork, ComponentType<SVGProps<SVGSVGElement>>> = {
  whatsapp: WhatsAppIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
};

const columnTitle = "text-[11px] font-semibold tracking-button uppercase";

export function SiteFooter() {
  const copyright = `© ${new Date().getFullYear()} RASSM. Tous droits réservés.`;

  return (
    <footer className="border-t border-line bg-bone text-ink">
      <Container className="grid gap-10 py-12 lg:grid-cols-[1.3fr_3fr_1.5fr] lg:gap-10 lg:py-14">
        <div>
          <Logo className="text-[2.25rem]" />
          <p lang="en" className="mt-2 text-[9px] font-semibold tracking-wide-label uppercase">
            Draw what you can&apos;t say.
          </p>
          <p className="mt-10 hidden text-xs text-ash lg:block">{copyright}</p>
        </div>

        <nav aria-label="Liens du pied de page" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className={columnTitle}>{column.title}</h2>
              <ul className="mt-4 space-y-2 text-[13px] text-ash">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div>
          <h2 className={columnTitle}>Restez connectés</h2>
          <ul className="mt-4 flex items-center gap-6">
            {SOCIAL_LINKS.map(({ network, label, href }) => {
              const Icon = SOCIAL_ICONS[network];
              return (
                <li key={network}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="block transition-opacity hover:opacity-60"
                  >
                    <Icon />
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[13px] text-ash">
            Une question ? WhatsApp :{" "}
            <a
              href={CONTACT.whatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-ink underline underline-offset-4 hover:no-underline"
            >
              {CONTACT.whatsapp.display}
            </a>
          </p>
          <p className="mt-6 text-[13px] text-ash">
            Nouveaux drops et coulisses, directement dans votre boîte mail.
          </p>
          <div className="mt-3">
            <NewsletterForm />
          </div>
        </div>

        <p className="text-xs text-ash lg:hidden">{copyright}</p>
      </Container>
    </footer>
  );
}
