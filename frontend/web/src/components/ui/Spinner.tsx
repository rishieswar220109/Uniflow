export function Spinner({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span
      className={size === 'lg' ? 'spinner spinner-lg' : 'spinner'}
      aria-hidden="true"
    />
  )
}
