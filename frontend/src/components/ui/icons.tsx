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

export function HomeIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3.5 11 12 4l8.5 7M6 9v11h12V9" />
      <path d="M10 20v-5.5h4V20" />
    </LineIcon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.25" />
    </LineIcon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <path d="M13 4.5v5M7 14.5v5" />
    </LineIcon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M8.5 8.5h11v11h-11z" />
      <path d="M15.5 8.5v-4h-11v11h4" />
    </LineIcon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
    </LineIcon>
  );
}

export function CoinsIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 10v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4M5 14v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" />
    </LineIcon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5 7.5 20h9l1-13.5M10 10.5v6M14 10.5v6" />
    </LineIcon>
  );
}

export function GripIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path
        d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </LineIcon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 16.5v-12M7 9.5l5-5 5 5M4 20.5h16" />
    </LineIcon>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M13.5 4.5h6v6M19.5 4.5 11 13M17 14v5.5H4.5V7H10" />
    </LineIcon>
  );
}

export function MegaphoneIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 10v4h3l9 4.5V5.5L7 10z" />
      <path d="M7 14l1.5 5h3L10 15M19 9.5v5" />
    </LineIcon>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </LineIcon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" />
    </LineIcon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.5v.5" />
    </LineIcon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4" />
    </LineIcon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 20h16M4 20V4" />
      <path d="M7.5 15.5l4-4.5 3 3 5-6" />
    </LineIcon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4.5M12 16.8v.4" />
    </LineIcon>
  );
}

export function ArchiveIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M3.5 5.5h17v4h-17zM5 9.5v10h14v-10M10 13h4" />
    </LineIcon>
  );
}

export function MailOpenIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 10l8-5.5 8 5.5v9.5H4z" />
      <path d="M4 10l8 5.5 8-5.5" />
    </LineIcon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M5.5 10.5h13v10h-13z" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
      <path d="M12 14.5v2" />
    </LineIcon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </LineIcon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M14.1 14.2A3 3 0 0 1 9.8 9.9M6.4 7.6C3.9 9.3 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1" />
      <path d="m3.5 3.5 17 17" />
    </LineIcon>
  );
}

export function LaptopIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4.5 5.5h15v10h-15z" />
      <path d="M2.5 18.5h19" />
    </LineIcon>
  );
}

export function SmartphoneIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M7.5 2.5h9v19h-9z" />
      <path d="M11 18.5h2" />
    </LineIcon>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" />
    </LineIcon>
  );
}
