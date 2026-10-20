"use client";

import {
  CONTACT_SUBJECTS,
  CONTACT_SUBJECT_LABELS,
  MESSAGE_FOLDERS,
  MESSAGE_FOLDER_LABELS,
  type AdminMessage,
  type ContactSubject,
  type MessageFolder,
} from "@rassm/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRightIcon, SearchIcon } from "@/components/ui/icons";
import { formatPhone, formatRelativeTime } from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fetchMessages } from "@/lib/data/admin";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminSelect,
  InitialAvatar,
  Pagination,
  adminInput,
} from "./admin-ui";
import { Pill } from "./badges";
import { formatNumber } from "./stats-ui";

// Messages of the contact page: unread ones highlighted, folders, subject filter, search.

const DEFAULT_PAGE_SIZE = 20;

interface Filters {
  folder: MessageFolder;
  subject: ContactSubject | "all";
  q: string;
  page: number;
  pageSize: number;
}

function readFilters(params: URLSearchParams): Filters {
  const positive = (value: string | null, fallback: number) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  };
  const pick = <T extends string>(list: readonly T[], value: string | null, fallback: T) =>
    list.find((item) => item === value) ?? fallback;
  return {
    folder: pick(MESSAGE_FOLDERS, params.get("dossier"), "inbox"),
    subject: pick([...CONTACT_SUBJECTS, "all"] as const, params.get("sujet"), "all"),
    q: params.get("q") ?? "",
    page: positive(params.get("page"), 1),
    pageSize: positive(params.get("par"), DEFAULT_PAGE_SIZE),
  };
}

export function MessagesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = readFilters(params);
  const [search, setSearch] = useState(filters.q);

  const setFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, page: 1, ...patch };
    const query = new URLSearchParams();
    if (next.folder !== "inbox") query.set("dossier", next.folder);
    if (next.subject !== "all") query.set("sujet", next.subject);
    if (next.q) query.set("q", next.q);
    if (next.page > 1) query.set("page", String(next.page));
    if (next.pageSize !== DEFAULT_PAGE_SIZE) query.set("par", String(next.pageSize));
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (search.trim() === filters.q) return;
    const timer = setTimeout(() => setFilters({ q: search.trim() }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text changes
  }, [search]);

  const apiQuery = {
    folder: filters.folder,
    subject: filters.subject,
    q: filters.q || undefined,
    page: filters.page,
    limit: filters.pageSize,
  };
  const query = useQuery({
    queryKey: ["admin", "messages", apiQuery],
    queryFn: () => fetchMessages(apiQuery),
    placeholderData: keepPreviousData,
  });
  const messages = query.data?.messages ?? [];
  const total = query.data?.total ?? 0;
  const unread = query.data?.counts.unread ?? 0;

  return (
    <>
      <AdminPageHeader
        title="Messages"
        count={query.data ? `${formatNumber(unread)} non lu${unread > 1 ? "s" : ""}` : undefined}
        subtitle="Les messages de la page Contact"
      />

      <div className="mt-7 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 xl:pb-0">
          <div
            role="tablist"
            aria-label="Dossiers"
            className="flex w-max overflow-hidden rounded-sm border border-line bg-paper"
          >
            {MESSAGE_FOLDERS.map((folder) => {
              const active = folder === filters.folder;
              return (
                <button
                  key={folder}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilters({ folder })}
                  className={cn(
                    "flex h-11 items-center gap-2.5 border-r border-line px-5 text-sm whitespace-nowrap last:border-r-0",
                    active ? "bg-ink text-paper" : "text-ink hover:bg-cream/60",
                  )}
                >
                  {MESSAGE_FOLDER_LABELS[folder]}
                  <span className={cn("text-xs tabular-nums", active ? "text-mist" : "text-stone")}>
                    {query.data?.counts[folder] ?? "·"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 xl:justify-end">
          <label className="relative col-span-2 sm:min-w-56 sm:flex-1 xl:max-w-80">
            <span className="sr-only">Rechercher un message</span>
            <SearchIcon
              width={18}
              height={18}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone"
            />
            <input
              type="text"
              inputMode="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom, téléphone, texte…"
              className={cn(adminInput, "pl-10 text-sm")}
            />
          </label>
          <AdminSelect
            label="Sujet"
            value={filters.subject}
            onChange={(value) => setFilters({ subject: value as Filters["subject"] })}
            className="col-span-2 sm:w-48"
            options={[
              { value: "all", label: "Sujet : tous" },
              ...CONTACT_SUBJECTS.map((subject) => ({
                value: subject,
                label: CONTACT_SUBJECT_LABELS[subject],
              })),
            ]}
          />
        </div>
      </div>

      <div className="mt-4">
        {query.isPending ? (
          <AdminEmpty>Chargement des messages…</AdminEmpty>
        ) : query.isError ? (
          <AdminEmpty tone="error">
            {query.error instanceof ApiError
              ? query.error.message
              : "Impossible de charger les messages."}
          </AdminEmpty>
        ) : messages.length === 0 ? (
          <AdminEmpty>
            {filters.q || filters.subject !== "all"
              ? "Aucun message ne correspond à ces filtres."
              : filters.folder === "archived"
                ? "Aucun message archivé."
                : "Aucun message ici pour le moment."}
          </AdminEmpty>
        ) : (
          <ul
            className={cn(
              "space-y-2.5 lg:space-y-0 lg:overflow-hidden lg:rounded-md lg:border lg:border-line lg:bg-paper",
              query.isPlaceholderData && "opacity-60",
            )}
          >
            {messages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}
          </ul>
        )}
        {total > 0 && (
          <Pagination
            page={filters.page}
            pageSize={filters.pageSize}
            total={total}
            unit="messages"
            onPage={(page) => setFilters({ page })}
            onPageSize={(pageSize) => setFilters({ pageSize })}
          />
        )}
      </div>
    </>
  );
}

function MessageRow({ message }: { message: AdminMessage }) {
  const name = `${message.firstName} ${message.lastName}`;
  return (
    <li
      className={cn(
        "relative flex items-start gap-3 rounded-md border border-line p-3.5 hover:bg-cream/50",
        "lg:rounded-none lg:border-0 lg:border-b lg:px-5 lg:py-4 lg:last:border-b-0",
        message.read ? "bg-paper" : "bg-sand/45 lg:shadow-[inset_3px_0_0_var(--color-ink)]",
      )}
    >
      <InitialAvatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link
            href={adminRoutes.message(message.id)}
            className={cn(
              "truncate text-[15px] after:absolute after:inset-0 after:content-['']",
              !message.read && "font-semibold",
            )}
          >
            {name}
          </Link>
          <span className="text-[13px] text-ash tabular-nums">{formatPhone(message.phone)}</span>
          <Pill tone="sand" size="sm">
            {CONTACT_SUBJECT_LABELS[message.subject]}
          </Pill>
          {!message.read && (
            <Pill tone="ink" size="sm">
              Non lu
            </Pill>
          )}
        </div>
        <p className={cn("mt-1 line-clamp-2 text-sm", message.read ? "text-stone" : "text-ash")}>
          {message.message}
        </p>
      </div>
      <time
        dateTime={message.createdAt}
        className="shrink-0 text-xs text-stone tabular-nums lg:text-[13px]"
      >
        {formatRelativeTime(message.createdAt)}
      </time>
      <ChevronRightIcon
        width={18}
        height={18}
        className="hidden shrink-0 self-center text-ash lg:block"
      />
    </li>
  );
}
