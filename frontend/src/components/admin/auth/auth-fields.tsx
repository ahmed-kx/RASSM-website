"use client";

import { ADMIN_PASSWORD_MIN_LENGTH } from "@rassm/shared";
import {
  useState,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon } from "@/components/ui/icons";
import { describedBy } from "@/components/ui/form-field";
import { cn } from "@/lib/cn";

// Fields of the login, forgot password and new password cards (design/admin-login.png):
// spaced uppercase label, input with a thin icon, French error under it. Sizes are design pixels
// times --u (set by AuthShell on computers; 1px elsewhere, e.g. Paramètres > Sécurité).

export const PASSWORD_HINT = `Au moins ${ADMIN_PASSWORD_MIN_LENGTH} caractères, sans « rassm » ni mot de passe courant. Une phrase de plusieurs mots est idéale.`;

const inputClass =
  "h-[max(36px,calc(53*var(--u,1px)))] w-full border border-ink/20 bg-paper/50 pl-[max(40px,calc(54*var(--u,1px)))] font-auth text-[max(13px,calc(13.5*var(--u,1px)))] font-light tracking-[0.03em] text-ink placeholder:text-stone/80 transition-colors focus:border-ink/60 focus:bg-paper focus:outline-none aria-invalid:border-error";

export function AuthField({
  id,
  label,
  icon: Icon,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  error: string | undefined;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[max(9.5px,calc(12.5*var(--u,1px)))] font-semibold tracking-[0.26em] text-ink uppercase"
      >
        {label}
      </label>
      <div className="relative mt-[max(6px,calc(10*var(--u,1px)))]">
        <Icon className="pointer-events-none absolute top-1/2 left-[max(13px,calc(18*var(--u,1px)))] size-[max(15px,calc(18*var(--u,1px)))] -translate-y-1/2 text-ash" />
        {children}
      </div>
      {hint && !error && (
        <p className="mt-2 font-auth text-xs leading-relaxed font-light text-ash">{hint}</p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-2 font-auth text-[13px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthInput({
  id,
  error,
  withButton = false,
  ...props
}: Omit<ComponentProps<"input">, "className"> & {
  id: string;
  error: string | undefined;
  /** Room on the right for a button (show / hide the password). */
  withButton?: boolean;
}) {
  return (
    <input
      id={id}
      {...describedBy(id, error)}
      {...props}
      className={cn(inputClass, withButton ? "pr-14" : "pr-4")}
    />
  );
}

/** Password field with the lock icon and a show / hide button. */
export function PasswordField({
  id,
  label,
  error,
  hint,
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  id: string;
  label: string;
  error: string | undefined;
  hint?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <AuthField id={id} label={label} icon={LockIcon} error={error} hint={hint}>
      <AuthInput
        id={id}
        error={error}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        withButton
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute top-1/2 right-[max(2px,calc(8*var(--u,1px)))] grid size-11 -translate-y-1/2 place-items-center text-ash transition-colors hover:text-ink"
      >
        {visible ? (
          <EyeOffIcon className="size-[max(16px,calc(18*var(--u,1px)))]" />
        ) : (
          <EyeIcon className="size-[max(16px,calc(18*var(--u,1px)))]" />
        )}
      </button>
    </AuthField>
  );
}

export function AuthSubmit({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-[max(44px,calc(72*var(--u,1px)))] w-full items-center justify-center gap-[calc(18*var(--u,1px))] bg-ink text-[max(11px,calc(12*var(--u,1px)))] font-medium tracking-[0.32em] text-paper uppercase transition-colors hover:bg-graphite disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
      {!pending && <ArrowRightIcon className="size-[max(15px,calc(17*var(--u,1px)))]" />}
    </button>
  );
}

/** Form-level message: error (red rule) or information (dark rule). */
export function AuthAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "border-l-2 py-0.5 pl-3 font-auth text-[13px] leading-relaxed",
        tone === "error" ? "border-error text-error" : "border-ink text-ink",
      )}
    >
      {children}
    </p>
  );
}

export const authLink =
  "font-auth text-[max(12px,calc(12.5*var(--u,1px)))] text-ash underline underline-offset-4 transition-colors hover:text-ink";
