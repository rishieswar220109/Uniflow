import type { ReactNode } from 'react'

import { cx } from '../../utils/cx'
import {
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  ShieldCheckIcon,
} from '../icons'

type AlertVariant = 'error' | 'success' | 'info' | 'warning'

const icons = {
  error: AlertCircleIcon,
  success: CheckCircleIcon,
  info: InfoIcon,
  warning: ShieldCheckIcon,
}

export function Alert({
  variant = 'info',
  children,
  className,
}: {
  variant?: AlertVariant
  children: ReactNode
  className?: string
}) {
  const Icon = icons[variant]
  return (
    <div
      className={cx('alert', `alert-${variant}`, className)}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <Icon size={17} />
      <div>{children}</div>
    </div>
  )
}
