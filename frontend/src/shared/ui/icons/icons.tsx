import type { ReactElement, SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ children, strokeWidth = 1.7, ...rest }: IconProps): ReactElement {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function ProfileIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <circle cx={12} cy={8} r={3.4} />
      <path d="M5 20c1.6-3.4 4-5 7-5s5.4 1.6 7 5" />
    </BaseIcon>
  );
}

export function FeedIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3.5} y={5} width={17} height={14} rx={2} />
      <path d="M7 9h6" />
      <path d="M7 13h10" />
      <path d="M7 16.5h7" />
    </BaseIcon>
  );
}

export function MessagesIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 5.5h15v9.5H9.5l-5 4z" />
    </BaseIcon>
  );
}

export function FriendsIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <circle cx={9} cy={8.5} r={3} />
      <path d="M3 19.5c1.3-3 3.4-4.4 6-4.4s4.7 1.4 6 4.4" />
      <path d="M16.4 6.3a3 3 0 0 1 0 5.5" />
      <path d="M17.8 14.9c2 .7 3.4 2 4.2 4.1" />
    </BaseIcon>
  );
}

export function CommunitiesIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <circle cx={7} cy={9.5} r={2.6} />
      <circle cx={17} cy={9.5} r={2.6} />
      <circle cx={12} cy={16.5} r={2.6} />
      <path d="M9.2 11.2l1.6 2.9" />
      <path d="M14.8 11.2l-1.6 2.9" />
    </BaseIcon>
  );
}

export function GroupsIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={4} y={4.5} width={7} height={7} rx={1.6} />
      <rect x={13} y={4.5} width={7} height={7} rx={1.6} />
      <rect x={4} y={13.5} width={7} height={7} rx={1.6} />
      <rect x={13} y={13.5} width={7} height={7} rx={1.6} />
    </BaseIcon>
  );
}

export function SettingsIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4 8.5h9" />
      <path d="M18.5 8.5h2" />
      <path d="M4 15.5h3.5" />
      <path d="M13 15.5h7.5" />
      <circle cx={15.5} cy={8.5} r={2.4} />
      <circle cx={10} cy={15.5} r={2.4} />
    </BaseIcon>
  );
}

export function MoreIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon strokeWidth={2.6} {...props}>
      <path d="M5 12h.01" />
      <path d="M12 12h.01" />
      <path d="M19 12h.01" />
    </BaseIcon>
  );
}

export function BackIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </BaseIcon>
  );
}

export function SearchIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <circle cx={10.5} cy={10.5} r={6.5} />
      <path d="m20 20-4.6-4.6" />
    </BaseIcon>
  );
}

export function AddPersonIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <circle cx={9} cy={8.5} r={3} />
      <path d="M3 19.5c1.3-3 3.4-4.4 6-4.4 1.1 0 2.1.2 3 .6" />
      <path d="M18 7.5v6" />
      <path d="M15 10.5h6" />
    </BaseIcon>
  );
}

export function CloseIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </BaseIcon>
  );
}

export function BellIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 4.5c-3 0-4.6 2.2-4.6 5.4 0 4.3-1.4 5.6-1.9 6.4h13c-.5-.8-1.9-2.1-1.9-6.4 0-3.2-1.6-5.4-4.6-5.4z" />
      <path d="M10.2 19c.4.9 1 1.4 1.8 1.4s1.4-.5 1.8-1.4" />
    </BaseIcon>
  );
}

export function LocationIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 21c4-4.4 6.5-8 6.5-11.2A6.5 6.5 0 0 0 5.5 9.8C5.5 13 8 16.6 12 21z" />
      <circle cx={12} cy={9.8} r={2.2} />
    </BaseIcon>
  );
}

export function ShieldIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 3.5 5 6v6c0 4.6 3 8 7 9.5 4-1.5 7-4.9 7-9.5V6l-7-2.5z" />
      <path d="M9 12.2l2 2 4-4.4" />
    </BaseIcon>
  );
}

export function BanIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M6.5 6.5l11 11" />
    </BaseIcon>
  );
}

export function ChartIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M5 19V11" />
      <path d="M12 19V7" />
      <path d="M19 19v-5" />
      <path d="M4 19h16" />
    </BaseIcon>
  );
}

export function TagIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M11.5 3.5H6a2.5 2.5 0 0 0-2.5 2.5v5.5c0 .5.2 1 .6 1.4l8 8c.8.8 2 .8 2.8 0l5.5-5.5c.8-.8.8-2 0-2.8l-8-8c-.4-.4-.9-.6-1.4-.6z" />
      <circle cx={8} cy={8} r={1.2} fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function AttachmentIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M17 7.5 9.5 15a2.5 2.5 0 0 1-3.5-3.5L14 3.5a4 4 0 0 1 5.5 5.5L11 17.5a5.5 5.5 0 0 1-7.5-7.5" />
    </BaseIcon>
  );
}

export function PinIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <circle cx={12} cy={8} r={4} />
      <path d="M12 12v9" />
    </BaseIcon>
  );
}

export function EmojiIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M8.3 14c1 1.3 2.2 2 3.7 2s2.7-.7 3.7-2" />
      <circle cx={9} cy={10} r={0.9} fill="currentColor" stroke="none" />
      <circle cx={15} cy={10} r={0.9} fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function EditIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4 20l0.9-3.6L16.4 5 19 7.6 7.6 19.1 4 20z" />
      <path d="M14.5 6.9 17.1 9.5" />
    </BaseIcon>
  );
}

export function ForwardIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M13.5 6 19.5 12l-6 6" />
      <path d="M19 12H8.5A4.5 4.5 0 0 0 4 16.5V17" />
    </BaseIcon>
  );
}

export function ReplyIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M10.5 6 4.5 12l6 6" />
      <path d="M5 12h10.5A4.5 4.5 0 0 1 20 16.5V17" />
    </BaseIcon>
  );
}

export function FileIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M7 3.5h7l4 4V20a0.7 0.7 0 0 1-0.7 0.7H7A0.7 0.7 0 0 1 6.3 20V4.2A0.7 0.7 0 0 1 7 3.5z" />
      <path d="M14 3.5V8h4" />
    </BaseIcon>
  );
}

export function CopyIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={8.5} y={8.5} width={11} height={12} rx={1.8} />
      <path d="M15.5 8.5V6.3a1.8 1.8 0 0 0-1.8-1.8H6.3a1.8 1.8 0 0 0-1.8 1.8v9.4a1.8 1.8 0 0 0 1.8 1.8h2.2" />
    </BaseIcon>
  );
}

export function CheckIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </BaseIcon>
  );
}

// --- Website Builder: chrome (тулбар, canvas, инспектор) ---------------

export function PlusIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14M5 12h14" />
    </BaseIcon>
  );
}

export function TrashIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </BaseIcon>
  );
}

export function DuplicateIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={9} y={9} width={11} height={11} rx={2} />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </BaseIcon>
  );
}

export function EyeIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx={12} cy={12} r={3} />
    </BaseIcon>
  );
}

export function EyeOffIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.5 4.3" />
      <path d="M3 3l18 18" />
    </BaseIcon>
  );
}

export function UndoIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M9 7 4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
    </BaseIcon>
  );
}

export function RedoIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H9a5 5 0 0 0 0 10h1" />
    </BaseIcon>
  );
}

export function DesktopIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3} y={4} width={18} height={12} rx={2} />
      <path d="M8 20h8M12 16v4" />
    </BaseIcon>
  );
}

export function TabletIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={5} y={2} width={14} height={20} rx={2} />
      <path d="M12 18h.01" />
    </BaseIcon>
  );
}

export function MobileIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={7} y={2} width={10} height={20} rx={2} />
      <path d="M11 18h2" />
    </BaseIcon>
  );
}

export function ChevronDownIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M6 9l6 6 6-6" />
    </BaseIcon>
  );
}

export function ChevronUpIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M18 15l-6-6-6 6" />
    </BaseIcon>
  );
}

export function ChevronRightIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M9 6l6 6-6 6" />
    </BaseIcon>
  );
}

export function GripIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props} strokeWidth={0}>
      <circle cx={9} cy={6} r={1.4} fill="currentColor" />
      <circle cx={9} cy={12} r={1.4} fill="currentColor" />
      <circle cx={9} cy={18} r={1.4} fill="currentColor" />
      <circle cx={15} cy={6} r={1.4} fill="currentColor" />
      <circle cx={15} cy={12} r={1.4} fill="currentColor" />
      <circle cx={15} cy={18} r={1.4} fill="currentColor" />
    </BaseIcon>
  );
}

export function GlobeIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <circle cx={12} cy={12} r={9} />
      <path d="M3 12h18" />
      <path d="M12 3a14.5 14.5 0 0 1 0 18 14.5 14.5 0 0 1 0-18Z" />
    </BaseIcon>
  );
}

export function ExternalLinkIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
    </BaseIcon>
  );
}

export function ImageIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3} y={4} width={18} height={16} rx={2} />
      <circle cx={9} cy={10} r={1.6} />
      <path d="M21 16l-5.5-5.5a2 2 0 0 0-2.8 0L4 19" />
    </BaseIcon>
  );
}

export function VideoIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={2} y={5} width={14} height={14} rx={2} />
      <path d="M16 10.5 22 7v10l-6-3.5" />
    </BaseIcon>
  );
}

export function UploadIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </BaseIcon>
  );
}

export function PaletteIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1 .8-1.9 1.9-1.9h2.2a3 3 0 0 0 3-3C20 6.6 16.4 3 12 3Z" />
      <circle cx={7.5} cy={10.5} r={1.1} fill="currentColor" stroke="none" />
      <circle cx={10} cy={7} r={1.1} fill="currentColor" stroke="none" />
      <circle cx={15} cy={7.5} r={1.1} fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function StarIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 3.5 14.6 9l6 .7-4.5 4.1 1.2 5.9L12 16.8 6.7 19.7l1.2-5.9L3.4 9.7l6-.7 2.6-5.5Z" />
    </BaseIcon>
  );
}

export function ClockIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7v5l3.5 2" />
    </BaseIcon>
  );
}

export function MailIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3} y={5} width={18} height={14} rx={2} />
      <path d="m4 6.5 8 6.5 8-6.5" />
    </BaseIcon>
  );
}

export function CodeIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M8 6 3 12l5 6" />
      <path d="M16 6l5 6-5 6" />
    </BaseIcon>
  );
}

export function HeartIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 20s-7-4.4-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9Z" />
    </BaseIcon>
  );
}

export function BriefcaseIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3} y={7} width={18} height={13} rx={2} />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </BaseIcon>
  );
}

export function UtensilsIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11" />
      <path d="M17 3c-1.4 0-3 1.7-3 4.5S15.6 12 17 12v9" />
    </BaseIcon>
  );
}

export function ShoppingBagIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </BaseIcon>
  );
}

export function SparkleIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
    </BaseIcon>
  );
}

export function DumbbellIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M6.5 7v10M17.5 7v10" />
      <path d="M2.5 10v4M21.5 10v4" />
      <path d="M6.5 12h11" />
    </BaseIcon>
  );
}

export function GraduationCapIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M2 9 12 4l10 5-10 5-10-5Z" />
      <path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5" />
    </BaseIcon>
  );
}

export function CpuIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={7} y={7} width={10} height={10} rx={1.5} />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </BaseIcon>
  );
}

export function WalletIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3} y={6} width={18} height={13} rx={2} />
      <path d="M3 10h18" />
      <path d="M16 14.5h2" />
      <path d="M7 6V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" />
    </BaseIcon>
  );
}

export function DatabaseIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <ellipse cx={12} cy={5.5} rx={8} ry={3} />
      <path d="M4 5.5v13c0 1.66 3.58 3 8 3s8-1.34 8-3v-13" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </BaseIcon>
  );
}

export function BuildingIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={4} y={3} width={16} height={18} rx={1} />
      <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
    </BaseIcon>
  );
}

export function BedIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 18v2M21 18v2M3 12V8a2 2 0 0 1 2-2h4v4" />
    </BaseIcon>
  );
}

export function ColumnsIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3} y={4} width={18} height={16} rx={2} />
      <path d="M12 4v16" />
    </BaseIcon>
  );
}

export function GridIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3} y={3} width={8} height={8} rx={1.5} />
      <rect x={13} y={3} width={8} height={8} rx={1.5} />
      <rect x={3} y={13} width={8} height={8} rx={1.5} />
      <rect x={13} y={13} width={8} height={8} rx={1.5} />
    </BaseIcon>
  );
}

export function RowsIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3} y={4} width={18} height={16} rx={2} />
      <path d="M3 10h18M3 16h18" />
    </BaseIcon>
  );
}

export function ButtonClickIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3} y={8} width={18} height={8} rx={4} />
      <path d="M9 12h6" />
    </BaseIcon>
  );
}

export function MegaphoneIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M3 10v4a1 1 0 0 0 1 1h2l6 4V5L6 9H4a1 1 0 0 0-1 1Z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M19 6a8 8 0 0 1 0 12" />
    </BaseIcon>
  );
}

export function MinusIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function QuoteIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M7 8.3c-2 1-3 2.5-3 4.9s1.5 3.9 3.4 3.9c1.5 0 2.5-1 2.5-2.4 0-1.3-.9-2.1-2-2.3.2-1.6 1.2-2.6 3-3.3L9.4 6C8.4 6.3 7.6 6.6 7 8.3Z" />
      <path d="M16 8.3c-2 1-3 2.5-3 4.9s1.5 3.9 3.4 3.9c1.5 0 2.5-1 2.5-2.4 0-1.3-.9-2.1-2-2.3.2-1.6 1.2-2.6 3-3.3L18.4 6c-1 .3-1.8.6-2.4 2.3Z" />
    </BaseIcon>
  );
}

export function ReceiptIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M6.5 3.5h11v17l-2.2-1.5-1.8 1.5-1.8-1.5-1.8 1.5-1.8-1.5-1.6 1.5v-17Z" />
      <path d="M9 8h6M9 11.5h6M9 15h4" />
    </BaseIcon>
  );
}

export function CalendarIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={3.5} y={5} width={17} height={15} rx={2} />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M8 13.5h1M12 13.5h1M16 13.5h1M8 17h1M12 17h1" />
    </BaseIcon>
  );
}

export function NewspaperIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M5 5.5h11a2 2 0 0 1 2 2V17a1.5 1.5 0 0 0 1.5 1.5H7A2 2 0 0 1 5 16.5V5.5Z" />
      <path d="M18 18.5A1.5 1.5 0 0 1 16.5 17V8" />
      <path d="M8 9h6M8 12h6M8 15h4" />
    </BaseIcon>
  );
}

export function AlignLeftIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4 6h16M4 11h10M4 16h13M4 20h7" />
    </BaseIcon>
  );
}

export function AlignCenterIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4 6h16M7 11h10M5.5 16h13M9 20h6" />
    </BaseIcon>
  );
}

export function AlignRightIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M4 6h16M10 11h10M7 16h13M13 20h7" />
    </BaseIcon>
  );
}

// Схематичные превью структурных блоков (`BlockThumbnail`, `entities/
// website/ui/`) — рамка «страницы» + внутри неё лента, показывающая, как
// именно этот блок займёт место на странице (во всю ширину/с полями/
// колонками) — в отличие от обычных иконок выше, эти нужны только затем,
// чтобы за один взгляд было видно СТРУКТУРУ, не просто узнаваемый значок.

export function PreviewFullWidthIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={2.5} y={3.5} width={19} height={17} rx={1.5} />
      <rect
        x={2.5}
        y={9.5}
        width={19}
        height={5}
        fill="currentColor"
        stroke="none"
        opacity={0.35}
      />
    </BaseIcon>
  );
}

export function PreviewContainerIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={2.5} y={3.5} width={19} height={17} rx={1.5} />
      <rect
        x={6}
        y={9.5}
        width={12}
        height={5}
        rx={0.5}
        fill="currentColor"
        stroke="none"
        opacity={0.35}
      />
    </BaseIcon>
  );
}

export function PreviewColumnsIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={2.5} y={3.5} width={19} height={17} rx={1.5} />
      <rect
        x={5}
        y={7}
        width={4.3}
        height={10}
        rx={0.5}
        fill="currentColor"
        stroke="none"
        opacity={0.35}
      />
      <rect
        x={9.85}
        y={7}
        width={4.3}
        height={10}
        rx={0.5}
        fill="currentColor"
        stroke="none"
        opacity={0.35}
      />
      <rect
        x={14.7}
        y={7}
        width={4.3}
        height={10}
        rx={0.5}
        fill="currentColor"
        stroke="none"
        opacity={0.35}
      />
    </BaseIcon>
  );
}

export function PreviewSpacerIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={2.5} y={3.5} width={19} height={17} rx={1.5} />
      <path d="M6 8h12" opacity={0.35} />
      <path d="M6 16h12" opacity={0.35} />
      <path d="M12 10.5v3" strokeDasharray="1.5 1.5" />
    </BaseIcon>
  );
}

export function PreviewDividerIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <rect x={2.5} y={3.5} width={19} height={17} rx={1.5} />
      <path d="M6 12h12" />
    </BaseIcon>
  );
}
