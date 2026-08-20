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

export function BellIcon(props: IconProps): ReactElement {
  return (
    <BaseIcon {...props}>
      <path d="M12 4.5c-3 0-4.6 2.2-4.6 5.4 0 4.3-1.4 5.6-1.9 6.4h13c-.5-.8-1.9-2.1-1.9-6.4 0-3.2-1.6-5.4-4.6-5.4z" />
      <path d="M10.2 19c.4.9 1 1.4 1.8 1.4s1.4-.5 1.8-1.4" />
    </BaseIcon>
  );
}
