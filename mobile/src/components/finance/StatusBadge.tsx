import { Badge } from '../ui/Badge'
import { titleCase } from '../../utils/format'

const SUCCESS = new Set([
  'active',
  'succeeded',
  'paid',
  'done',
  'connected',
])

const PRIMARY = new Set(['upcoming', 'due', 'running', 'unpaid', 'income'])

const WARNING = new Set(['overdue', 'expired', 'partial', 'mock', 'expense'])

const DANGER = new Set([
  'failed',
  'revoked',
  'cancelled',
  'skipped',
  'error',
])

type Tone = 'success' | 'primary' | 'warning' | 'danger' | 'neutral'

function toneFor(status: string): Tone {
  const key = status.toLowerCase()
  if (SUCCESS.has(key)) return 'success'
  if (PRIMARY.has(key)) return 'primary'
  if (WARNING.has(key)) return 'warning'
  if (DANGER.has(key)) return 'danger'
  return 'neutral'
}

export function statusTone(status: string): Tone {
  return toneFor(status)
}

export function StatusBadge({
  status,
  label,
}: {
  status: string
  label?: string
}) {
  return <Badge label={label ?? titleCase(status)} tone={toneFor(status)} />
}

export function MockBadge() {
  return <Badge label="Mock data" tone="warning" icon="flask-outline" />
}
