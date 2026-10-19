import Link from "next/link";
import { proseLink } from "@/components/info/info-page";
import { PlusIcon } from "@/components/ui/icons";
import type { FaqAnswerPart, FaqGroup } from "@/content/faq";

function AnswerPart({ part }: { part: FaqAnswerPart }) {
  if (typeof part === "string") return part;
  if (part.href.startsWith("/")) {
    return (
      <Link href={part.href} className={proseLink}>
        {part.label}
      </Link>
    );
  }
  const web = part.href.startsWith("http");
  return (
    <a
      href={part.href}
      className={proseLink}
      {...(web && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {part.label}
    </a>
  );
}

/**
 * FAQ grouped by theme. Each question is a native <details>: it opens with a click, Enter or
 * Space, works without JavaScript, and its answer is in the page for search engines.
 */
export function FaqAccordion({ groups }: { groups: readonly FaqGroup[] }) {
  return (
    <div className="space-y-12 md:space-y-14">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`faq-${group.id}`}>
          <h2
            id={`faq-${group.id}`}
            className="font-display text-[1.85rem] leading-none font-medium uppercase md:text-[2.2rem]"
          >
            {group.title}
          </h2>
          <div className="mt-5 border-t border-ink">
            {group.items.map((item) => (
              <details key={item.question} className="group border-b border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[15px] font-semibold text-ink outline-none focus-visible:underline focus-visible:decoration-1 focus-visible:underline-offset-4 md:text-base [&::-webkit-details-marker]:hidden">
                  <h3>{item.question}</h3>
                  <PlusIcon
                    width={16}
                    height={16}
                    className="shrink-0 transition-transform duration-200 group-open:rotate-45"
                  />
                </summary>
                <p className="max-w-2xl pb-6 text-[15px] leading-relaxed text-ash">
                  {item.answer.map((part, index) => (
                    <AnswerPart key={index} part={part} />
                  ))}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
