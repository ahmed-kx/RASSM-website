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
// spaced uppercase label, input with a thin icon, French error under it.

export const PASSWORD_HINT = `Au moins ${ADMIN_PASSWORD_MIN_LENGTH} caractères, sans « rassm » ni mot de passe courant. Une phrase de plusieurs mots est idéale.`;

const inputClass =
  "h-[3.25rem] w-full border border-ink/25 bg-paper/60 pl-12 text-[15px] text-ink placeholder:text-stone/80 transition-colors focus:border-ink focus:bg-paper focus:outline-none aria-invalid:border-error";

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
      <label htmlFor={id} className="text-xs font-semibold tracking-label text-ink uppercase">
        {label}
      </label>
      <div className="relative mt-3">
        <Icon
          width={19}
          height={19}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ash"
        />
        {children}
      </div>
      {hint && !error && <p className="mt-2 text-xs leading-relaxed text-ash">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-error">
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
        className="absolute top-1/2 right-1.5 grid size-11 -translate-y-1/2 place-items-center text-ash transition-colors hover:text-ink"
      >
        {visible ? <EyeOffIcon width={19} height={19} /> : <EyeIcon width={19} height={19} />}
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
      className="flex h-16 w-full items-center justify-center gap-4 bg-ink text-xs font-semibold tracking-label text-paper uppercase transition-colors hover:bg-graphite disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
      {!pending && <ArrowRightIcon width={18} height={18} />}
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
        "border-l-2 py-0.5 pl-3 text-sm leading-relaxed",
        tone === "error" ? "border-error text-error" : "border-ink text-ink",
      )}
    >
      {children}
    </p>
  );
}

export const authLink =
  "text-[13px] text-ash underline underline-offset-4 transition-colors hover:text-ink";
