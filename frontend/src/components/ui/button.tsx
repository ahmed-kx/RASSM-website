import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ArrowRightIcon } from "./icons";

export type ButtonVariant = "filled" | "outlined";
/** The background the button sits on. */
export type Surface = "dark" | "light";

interface BaseProps {
  variant?: ButtonVariant;
  surface?: Surface;
  withArrow?: boolean;
  className?: string;
  children: ReactNode;
}

type LinkButtonProps = BaseProps & { href: string; onClick?: () => void };
type NativeButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };

const VARIANT_CLASSES: Record<Surface, Record<ButtonVariant, string>> = {
  dark: {
    filled: "border-paper bg-paper text-ink hover:bg-cream hover:border-cream",
    outlined: "border-paper text-paper hover:bg-paper hover:text-ink",
  },
  light: {
    filled: "border-ink bg-ink text-paper hover:bg-graphite hover:border-graphite",
    outlined: "border-ink text-ink hover:bg-ink hover:text-paper",
  },
};

export function buttonClasses(variant: ButtonVariant, surface: Surface, className?: string) {
  return cn(
    "group inline-flex h-12 items-center justify-center gap-3 border px-6 text-[11px] font-semibold tracking-button uppercase transition-colors duration-200 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current",
    VARIANT_CLASSES[surface][variant],
    className,
  );
}

/** Filled or outlined button. Renders a link when `href` is given. */
export function Button(props: LinkButtonProps | NativeButtonProps) {
  const { variant = "filled", surface = "dark", withArrow = false, className, children } = props;
  const content = (
    <>
      <span>{children}</span>
      {withArrow && (
        <ArrowRightIcon className="transition-transform duration-200 motion-safe:group-hover:translate-x-1" />
      )}
    </>
  );

  if (props.href !== undefined) {
    return (
      <Link
        href={props.href}
        onClick={props.onClick}
        className={buttonClasses(variant, surface, className)}
      >
        {content}
      </Link>
    );
  }

  const {
    variant: _variant,
    surface: _surface,
    withArrow: _withArrow,
    className: _className,
    children: _children,
    type = "button",
    ...rest
  } = props;
  return (
    <button type={type} className={buttonClasses(variant, surface, className)} {...rest}>
      {content}
    </button>
  );
}
