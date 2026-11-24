import { cx } from '../../utils/cx'

const SUCCESS = new Set([
  'active',
  'succeeded',
  'paid',
  'done',
  'connected',
])

const PRIMARY = new Set(['upcoming', 'due', 'running', 'unpaid', 'income'])

const WARNING = new Set([
  'overdue',
  'expired',
  'partial',
  'mock',
  'expense',
])

const DANGER = new Set([
  'failed',
  'revoked',
  'cancelled',
  'skipped',
  'error',
])

const NEUTRAL = new Set(['paused', 'pending', 'none', 'inactive'])

function statusTone(status: string): string {
  const key = status.toLowerCase()
  if (SUCCESS.has(key)) return 'badge-success'
  if (PRIMARY.has(key)) return 'badge-primary'
  if (WARNING.has(key)) return 'badge-warning'
  if (DANGER.has(key)) return 'badge-danger'
  if (NEUTRAL.has(key)) return 'badge-neutral'
  return 'badge-neutral'
}

function statusLabel(status: string): string {
  return status
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string
  label?: string
  className?: string
}) {
  return (
    <span
      className={cx('badge', 'badge-plain', statusTone(status), className)}
    >
      {label ?? statusLabel(status)}
    </span>
  )
}

export function MockBadge({ className }: { className?: string }) {
  return (
    <span className={cx('badge', 'badge-plain', 'badge-warning', className)}>
      Mock data
    </span>
  )
}
