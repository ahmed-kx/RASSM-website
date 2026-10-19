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

export function PhoneIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M8.5 3.5H5.2a1.5 1.5 0 0 0-1.5 1.6c.6 8.1 7.1 14.6 15.2 15.2a1.5 1.5 0 0 0 1.6-1.5v-3.3l-4-1.6-2 2.3a12 12 0 0 1-5.7-5.7l2.3-2-1.6-4Z" />
    </LineIcon>
  );
}

/** WhatsApp, drawn as a thin line: round speech bubble with a handset inside. */
export function WhatsAppIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M7.5 19.8A8.8 8.8 0 1 0 4.2 16.5L3 21l4.5-1.2Z" strokeLinejoin="round" />
      <path
        d="M9.6 7.8h-1a.8.8 0 0 0-.8.9 7.6 7.6 0 0 0 7.5 7.5.8.8 0 0 0 .9-.8v-1l-2-.8-1 1.1a5.6 5.6 0 0 1-2.8-2.8l1.1-1-.9-2.1Z"
        strokeLinejoin="round"
      />
    </LineIcon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M10 14a4.2 4.2 0 0 0 6 0l3.2-3.2a4.2 4.2 0 0 0-6-6L11.8 6.2" />
      <path d="M14 10a4.2 4.2 0 0 0-6 0l-3.2 3.2a4.2 4.2 0 0 0 6 6l1.4-1.4" />
    </LineIcon>
  );
}

/** Four-point star (value "Authenticité"). */
export function SparkleIcon(props: IconProps) {
  return (
    <LineIcon width={40} height={40} strokeWidth={0.9} {...props}>
      <path
        d="M12 2.5c.6 5.2 3.3 8.5 8.5 9.5-5.2 1-7.9 4.3-8.5 9.5-.6-5.2-3.3-8.5-8.5-9.5 5.2-1 7.9-4.3 8.5-9.5Z"
        strokeLinejoin="round"
      />
    </LineIcon>
  );
}

/** Two overlapping circles (value "Créativité"). */
export function CirclesIcon(props: IconProps) {
  return (
    <LineIcon width={40} height={40} strokeWidth={0.9} {...props}>
      <circle cx="9" cy="12" r="6.5" />
      <circle cx="15" cy="12" r="6.5" />
    </LineIcon>
  );
}

/** Globe (value "Liberté"). */
export function GlobeIcon(props: IconProps) {
  return (
    <LineIcon width={40} height={40} strokeWidth={0.9} {...props}>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18M4.5 7h15M4.5 17h15" />
    </LineIcon>
  );
}

// Dashboard icons (admin).

export function DashboardIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v4h-7zM13.5 10.5h7v10h-7zM3.5 13.5h7v7h-7z" />
    </LineIcon>
  );
}

export function OrdersIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </LineIcon>
  );
}

export function ShirtIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M8.5 3.5 3 6.5l2 4 2-1v11h10v-11l2 1 2-4-5.5-3c-.5 1.6-2 2.5-3.5 2.5S9 5.1 8.5 3.5Z" />
    </LineIcon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3 5.5h18v13H3z" />
      <path d="m3 6 9 7 9-7" />
    </LineIcon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .7 3.2 2.4 3.5 5.2" />
    </LineIcon>
  );
}

export function BanIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </LineIcon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M14 4H5v16h9M10 12h11M17 8l4 4-4 4" />
    </LineIcon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 21h4" />
    </LineIcon>
  );
}

export function SoundOnIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
    </LineIcon>
  );
}

export function SoundOffIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </LineIcon>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={2.5} strokeLinecap="round" />
    </LineIcon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 3.5v12M7 11l5 5 5-5M4 20.5h16" />
    </LineIcon>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="m15 4.5 4.5 4.5L8.5 20H4v-4.5z" />
      <path d="m12.5 7 4.5 4.5" />
    </LineIcon>
  );
}
