import { Spinner } from './Spinner'

export function PageLoader({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <Spinner size="lg" />
      <span>{label}</span>
    </div>
  )
}
