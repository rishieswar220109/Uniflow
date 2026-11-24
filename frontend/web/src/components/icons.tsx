import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l7 2.6v5.3c0 4.6-2.9 8.2-7 10.1-4.1-1.9-7-5.5-7-10.1V5.6L12 3z" />
      <path d="M9 12l2 2 4-4.2" />
    </Icon>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </Icon>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="10" width="16" height="10" rx="2.5" />
      <path d="M8 10V7a4 4 0 018 0v3" />
      <path d="M12 14.5v1.5" />
    </Icon>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4.5v-5.5h-5V21H5a1 1 0 01-1-1v-9.5z" />
    </Icon>
  )
}

export function WalletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7.5A2.5 2.5 0 016.5 5H18a1 1 0 011 1v2.5" />
      <rect x="4" y="7.5" width="16" height="11.5" rx="2.5" />
      <path d="M16 13.5h.01" />
    </Icon>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8 3.5v4M16 3.5v4" />
    </Icon>
  )
}

export function SparklesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l1.5 4.3L18 9l-4.5 1.7L12 15l-1.5-4.3L6 9l4.5-1.7L12 3z" />
      <path d="M18.5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
      <path d="M5.5 14l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z" />
    </Icon>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.88l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.88-.34 1.7 1.7 0 00-1.03 1.56V21a2 2 0 11-4 0v-.09A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.88.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 005 15a1.7 1.7 0 00-1.56-1.03H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.88l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 5a1.7 1.7 0 001.03-1.56V3a2 2 0 114 0v.09A1.7 1.7 0 0015 4.6a1.7 1.7 0 001.88-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9v.09A1.7 1.7 0 0021 10.1a2 2 0 110 4h-.09A1.7 1.7 0 0019.4 15z" />
    </Icon>
  )
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.6-3.4 3.3-5.4 7-5.4s6.4 2 7 5.4" />
    </Icon>
  )
}

export function LogoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" />
      <path d="M15 8l4 4-4 4M19 12H9" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.2 4.2L19 7" />
    </Icon>
  )
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9a6 6 0 0112 0c0 5 1.5 6 1.5 6h-15S6 14 6 9z" />
      <path d="M10 19a2 2 0 004 0" />
    </Icon>
  )
}

export function GlobeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.3 3.8 8.5S14.5 18.2 12 20.5C9.5 18.2 8.2 15.2 8.2 12S9.5 5.8 12 3.5z" />
    </Icon>
  )
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
    </Icon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 5l7 7-7 7" />
    </Icon>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Icon>
  )
}

export function AlertCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16h.01" />
    </Icon>
  )
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.5" />
    </Icon>
  )
}

export function LandmarkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 9.5L12 4l8.5 5.5" />
      <path d="M5.5 10.5v7M10 10.5v7M14 10.5v7M18.5 10.5v7M3.5 20h17" />
    </Icon>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function KeyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2L19 4M16 7l2 2M14 9l2 2" />
    </Icon>
  )
}

export function TargetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12h.01" />
    </Icon>
  )
}

export function TrendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 17l5-5 4 3 7-8" />
      <path d="M15 7h5v5" />
    </Icon>
  )
}
