import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { AuthShell } from '../components/layout/AuthShell'
import { useAuth } from '../features/auth/AuthContext'
import { validateLogin, type FormErrors, type LoginFormValues } from '../features/auth/validation'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { extractApiError } from '../utils/errors'

type LoginLocationState = {
  from?: { pathname?: string }
}

export function LoginPage() {
  useDocumentTitle('Sign in')
  const { login, signedOutNotice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = (location.state as LoginLocationState | null) ?? {}

  const [values, setValues] = useState<LoginFormValues>({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<FormErrors<LoginFormValues>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateField = (field: keyof LoginFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateLogin(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setFormError('')
    try {
      await login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      })
      const destination = locationState.from?.pathname ?? '/dashboard'
      navigate(destination.startsWith('/') ? destination : '/dashboard', {
        replace: true,
      })
    } catch (error) {
      setFormError(
        extractApiError(error, 'Unable to sign in. Please check your details.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Guardian workspace."
      footer={
        <p className="auth-switch">
          New to AI Payment Guardian? <Link to="/register">Create an account</Link>
        </p>
      }
    >
      {signedOutNotice ? (
        <div style={{ marginBottom: 18 }}>
          <Alert variant="success">
            You have been signed out securely on this device.
          </Alert>
        </div>
      ) : null}

      {formError ? (
        <div style={{ marginBottom: 18 }}>
          <Alert variant="error">{formError}</Alert>
        </div>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
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
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          onChange={(event) => updateField('password', event.target.value)}
          error={errors.password}
          required
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="auth-legal">
        Password recovery and additional verification will be introduced in a
        later phase. For now, use the email and password you registered with.
      </p>
    </AuthShell>
  )
}
