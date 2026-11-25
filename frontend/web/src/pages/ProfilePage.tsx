import { useState, type FormEvent } from 'react'

import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../features/auth/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { userApi } from '../services/userApi'
import { extractApiError } from '../utils/errors'
import { formatDate, initials } from '../utils/format'

export function ProfilePage() {
  useDocumentTitle('Profile')
  const { user, updateUser } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [nameError, setNameError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  if (!user) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSuccess('')
    setFormError('')
    const cleaned = fullName.trim().replace(/\s+/g, ' ')
    if (cleaned.length < 2) {
      setNameError('Enter your full name (at least 2 characters).')
      return
    }
    setNameError('')
    setSaving(true)
    try {
      const updated = await userApi.updateProfile({ full_name: cleaned })
      updateUser(updated)
      setFullName(updated.full_name)
      setSuccess('Your profile has been updated.')
    } catch (error) {
      setFormError(
        extractApiError(error, 'Unable to update your profile right now.'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Account</span>
          <h1 className="page-title">Your profile</h1>
          <p className="page-subtitle">
            Keep your identity details current. Your email address is used to
            sign in and cannot be changed in Phase 1.
          </p>
        </div>
        <span className="badge badge-success">Active account</span>
      </header>

      <div className="form-page-grid">
        <div className="form-page-main">
          <section className="card" aria-labelledby="profile-form-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="profile-form-title">
                  Personal details
                </h2>
                <p className="card-subtitle">
                  This information is shown across the web and mobile apps.
                </p>
              </div>
            </div>

            {success ? (
              <div style={{ marginBottom: 18 }}>
                <Alert variant="success">{success}</Alert>
              </div>
            ) : null}
            {formError ? (
              <div style={{ marginBottom: 18 }}>
                <Alert variant="error">{formError}</Alert>
              </div>
            ) : null}

            <form className="form-stack" onSubmit={handleSubmit} noValidate>
              <Input
                label="Full name"
                name="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value)
                  setNameError('')
                  setSuccess('')
                }}
                error={nameError}
                required
              />
              <Input
                label="Email address"
                type="email"
                name="email"
                value={user.email}
                disabled
                hint="Email changes will be supported in a later phase."
              />

              <div className="form-actions">
                <Button type="submit" loading={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving || fullName === user.full_name}
                  onClick={() => {
                    setFullName(user.full_name)
                    setNameError('')
                    setFormError('')
                    setSuccess('')
                  }}
                >
                  Reset
                </Button>
              </div>
            </form>
          </section>

          <section className="card card-muted" aria-labelledby="privacy-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="privacy-title">
                  Your data
                </h2>
                <p className="card-subtitle">
                  Phase 1 stores only what is needed to operate your account.
                </p>
              </div>
            </div>
            <p className="muted-note" style={{ lineHeight: 1.65 }}>
              UniFlow stores your name, email address, preferences and securely
              hashed authentication records. No bank balances, transactions,
              banking passwords, PINs, OTPs or card credentials are stored in
              this phase.
            </p>
          </section>
        </div>

        <aside className="form-page-side">
          <section className="card" aria-labelledby="account-summary-title">
            <div className="inline" style={{ marginBottom: 16 }}>
              <span className="avatar" aria-hidden="true">
                {initials(user.full_name)}
              </span>
              <div className="stack-sm" style={{ gap: 1 }}>
                <strong style={{ fontSize: '0.93rem' }}>{user.full_name}</strong>
                <span className="muted-note">{user.email}</span>
              </div>
            </div>
            <div className="account-status">
              <span className="badge badge-success badge-plain">Verified</span>
              Your account is active and protected.
            </div>

            <dl className="detail-list" style={{ marginTop: 8 }}>
              <div className="detail-row">
                <dt className="detail-label">Member since</dt>
                <dd className="detail-value">{formatDate(user.created_at)}</dd>
              </div>
              <div className="detail-row">
                <dt className="detail-label">Preferred currency</dt>
                <dd className="detail-value">{user.preferences.currency}</dd>
              </div>
              <div className="detail-row">
                <dt className="detail-label">Timezone</dt>
                <dd className="detail-value">{user.preferences.timezone}</dd>
              </div>
              <div className="detail-row">
                <dt className="detail-label">Account ID</dt>
                <dd className="detail-value mono">{user.id}</dd>
              </div>
            </dl>
          </section>

          <section className="card" aria-labelledby="security-note-title">
            <div className="inline" style={{ marginBottom: 10 }}>
              <span className="feature-icon">
                <span aria-hidden="true">🔒</span>
              </span>
              <h2 className="card-title" id="security-note-title">
                Security note
              </h2>
            </div>
            <p className="muted-note" style={{ lineHeight: 1.65 }}>
              UniFlow will never ask for your internet-banking password, UPI
              PIN, OTP or CVV.

              Report anything suspicious before sharing credentials with any
              service.
            </p>
          </section>
        </aside>
      </div>
    </>
  )
}
