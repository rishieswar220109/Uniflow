import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

import { cx } from '../../utils/cx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  endAdornment?: ReactNode
}

export function Input({
  label,
  error,
  hint,
  endAdornment,
  id,
  className,
  required,
  ...props
}: InputProps) {
  const autoId = useId()
  const inputId = id ?? `field-${autoId}`
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined

  const input = (
    <input
      id={inputId}
      className={cx('input', className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      required={required}
      {...props}
    />
  )

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-muted">
            {' '}
            *
          </span>
        ) : null}
      </label>

      {endAdornment ? (
        <div className="password-field">
          {input}
          {endAdornment}
        </div>
      ) : (
        input
      )}

      {hint && !error ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
