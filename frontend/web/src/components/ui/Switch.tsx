import { useId } from 'react'

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="switch-row">
      <div className="switch-copy">
        <label className="switch-title" htmlFor={id}>
          {label}
        </label>
        {description ? <span className="switch-description">{description}</span> : null}
      </div>
      <span className="switch">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
        />
        <span className="switch-track" aria-hidden="true" />
      </span>
    </div>
  )
}
