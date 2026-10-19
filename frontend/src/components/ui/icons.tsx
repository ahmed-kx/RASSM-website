import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Thin line icon base: 24px grid, inherits text color, hidden from screen readers. */
function LineIcon({ children, strokeWidth = 1.25, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

function FilledIcon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </LineIcon>
  );
}

export function BagIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M5 8h14l-1 13H6L5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </LineIcon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3 7h18M3 12h18M3 17h18" />
    </LineIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="m5 5 14 14M19 5 5 19" />
    </LineIcon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <LineIcon width={16} height={16} {...props}>
      <path d="M3 12h17M14 6l6 6-6 6" />
    </LineIcon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M15 4.5 7.5 12l7.5 7.5" />
    </LineIcon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M9 4.5 16.5 12 9 19.5" />
    </LineIcon>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <LineIcon width={14} height={14} {...props}>
      <path d="M4 12h16" />
    </LineIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <LineIcon width={14} height={14} {...props}>
      <path d="m5 9 7 7 7-7" />
    </LineIcon>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </LineIcon>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h1M3.5 12h1M3.5 18h1" />
    </LineIcon>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <LineIcon width={16} height={16} {...props}>
      <path d="M3 6h18M6 12h12M10 18h4" />
    </LineIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <LineIcon width={14} height={14} strokeWidth={1.75} {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </LineIcon>
  );
}

export function ExchangeIcon(props: IconProps) {
  return (
    <LineIcon width={28} height={28} {...props}>
      <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />
    </LineIcon>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <LineIcon width={14} height={14} {...props}>
      <path d="M8.5 5v14M15.5 5v14" />
    </LineIcon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <LineIcon width={14} height={14} {...props}>
      <path d="M7 4.5v15l12-7.5-12-7.5Z" />
    </LineIcon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <LineIcon width={14} height={14} {...props}>
      <path d="M12 4v16M4 12h16" />
    </LineIcon>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <LineIcon width={28} height={28} {...props}>
      <path d="M1.5 5.5h12v10h-12z" />
      <path d="M13.5 8.5h4l3.5 3.5v3.5h-7.5" />
      <circle cx="5.5" cy="17.5" r="1.75" />
      <circle cx="17" cy="17.5" r="1.75" />
    </LineIcon>
  );
}

export function BoxIcon(props: IconProps) {
  return (
    <LineIcon width={28} height={28} {...props}>
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" />
      <path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" />
    </LineIcon>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <LineIcon width={28} height={28} {...props}>
      <path d="M12 2.5 19.5 5.5v6c0 4.5-3.2 8.3-7.5 10-4.3-1.7-7.5-5.5-7.5-10v-6L12 2.5Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </LineIcon>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <LineIcon width={18} height={18} strokeWidth={1.75} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
    </LineIcon>
  );
}

export function TikTokIcon(props: IconProps) {
  return (
    <FilledIcon {...props}>
      <path d="M16.6 2.5c.4 2.3 1.9 3.8 4.1 4v3.2c-1.5 0-2.9-.5-4.1-1.3v6.6c0 3.4-2.7 6-6 6s-5.9-2.6-5.9-6c0-3.4 2.9-6.1 6.4-5.8v3.3c-1.6-.3-3.2.9-3.2 2.5 0 1.5 1.2 2.7 2.7 2.7 1.6 0 2.7-1.2 2.7-3V2.5h3.3Z" />
    </FilledIcon>
  );
}
