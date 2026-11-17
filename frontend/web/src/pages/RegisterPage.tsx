import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthShell } from '../components/layout/AuthShell'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { useAuth } from '../features/auth/AuthContext'
import {
  validateRegistration,
  type FormErrors,
  type RegisterFormValues,
} from '../features/auth/validation'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { extractApiError } from '../utils/errors'

export function RegisterPage() {
  useDocumentTitle('Create account')
  const { register } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState<RegisterFormValues>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<FormErrors<RegisterFormValues>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateField = (field: keyof RegisterFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateRegistration(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setFormError('')
    try {
      await register({
        full_name: values.fullName.trim().replace(/\s+/g, ' '),
        email: values.email.trim().toLowerCase(),
        password: values.password,
      })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setFormError(
        extractApiError(
          error,
          'Unable to create your account. Please try again.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a secure Guardian workspace in under a minute."
      footer={
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      }
    >
      {formError ? (
        <div style={{ marginBottom: 18 }}>
          <Alert variant="error">{formError}</Alert>
        </div>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Full name"
          type="text"
          name="fullName"
          autoComplete="name"
          placeholder="e.g. Asha Verma"
          value={values.fullName}
          onChange={(event) => updateField('fullName', event.target.value)}
          error={errors.fullName}
          required
        />

        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(event) => updateField('email', event.target.value)}
          error={errors.email}
          required
        />

        <PasswordInput
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={values.password}
          onChange={(event) => updateField('password', event.target.value)}
          error={errors.password}
          hint="At least 8 characters, including a letter and a number."
          required
        />

        <PasswordInput
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={values.confirmPassword}
          onChange={(event) =>
            updateField('confirmPassword', event.target.value)
          }
          error={errors.confirmPassword}
          required
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>

      <p className="auth-legal">
        By creating an account, you confirm that these details are yours and
        that you will keep your sign-in credentials private. Guardian never asks
        for banking passwords, UPI PINs, OTPs or CVVs.
      </p>
    </AuthShell>
  )
}
