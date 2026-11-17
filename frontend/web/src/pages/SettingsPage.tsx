import { useState, type FormEvent } from 'react'

import {
  BellIcon,
  GlobeIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
} from '../components/icons'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Switch } from '../components/ui/Switch'
import { useAuth } from '../features/auth/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { userApi } from '../services/userApi'
import type { PreferencesUpdate, ThemePreference } from '../services/types'
import { extractApiError } from '../utils/errors'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED']

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
]

export function SettingsPage() {
  useDocumentTitle('Settings')
  const { user, updateUser } = useAuth()

  const [preferences, setPreferences] = useState<PreferencesUpdate>(() => ({
    currency: user?.preferences.currency ?? 'INR',
    timezone: user?.preferences.timezone ?? 'Asia/Kolkata',
    theme: user?.preferences.theme ?? 'system',
    email_notifications: user?.preferences.email_notifications ?? true,
    push_notifications: user?.preferences.push_notifications ?? true,
    weekly_summary: user?.preferences.weekly_summary ?? false,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!user) return null

  const currencyOptions = CURRENCIES.includes(String(preferences.currency))
    ? CURRENCIES
    : [String(preferences.currency), ...CURRENCIES]

  const timezoneOptions = TIMEZONES.includes(String(preferences.timezone))
    ? TIMEZONES
    : [String(preferences.timezone), ...TIMEZONES]

  const updatePreference = <K extends keyof PreferencesUpdate>(
    key: K,
    value: PreferencesUpdate[K],
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }))
    setSuccess('')
    setError('')
  }

  const resetPreferences = () => {
    setPreferences({
      currency: user.preferences.currency,
      timezone: user.preferences.timezone,
      theme: user.preferences.theme,
      email_notifications: user.preferences.email_notifications,
      push_notifications: user.preferences.push_notifications,
      weekly_summary: user.preferences.weekly_summary,
    })
    setSuccess('')
    setError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const updatedPreferences = await userApi.updatePreferences(preferences)
      updateUser({ ...user, preferences: updatedPreferences })
      setSuccess('Your preferences have been saved.')
    } catch (submitError) {
      setError(
        extractApiError(
          submitError,
          'Unable to save your preferences right now.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Workspace</span>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Choose how Guardian presents and communicates information. These
            preferences are shared by the web and mobile applications.
          </p>
        </div>
        <span className="badge badge-primary">Synced to your account</span>
      </header>

      <form className="form-page-grid" onSubmit={handleSubmit}>
        <div className="form-page-main">
          <section className="card" aria-labelledby="regional-title">
            {success ? (
              <div style={{ marginBottom: 18 }}>
                <Alert variant="success">{success}</Alert>
              </div>
            ) : null}
            {error ? (
              <div style={{ marginBottom: 18 }}>
                <Alert variant="error">{error}</Alert>
              </div>
            ) : null}

            <div className="section-heading">
              <h2 id="regional-title">Regional &amp; display</h2>
              <p>
                Guardian will use these when presenting amounts, dates and
                forecasts.
              </p>
            </div>

            <div className="form-stack">
              <div className="form-row">
                <div className="field">
                  <label className="field-label" htmlFor="currency">
                    Preferred currency
                  </label>
                  <select
                    id="currency"
                    className="select"
                    value={preferences.currency}
                    onChange={(event) =>
                      updatePreference('currency', event.target.value)
                    }
                  >
                    {currencyOptions.map((currency) => (
                      <option value={currency} key={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Display currency for future financial summaries.
                  </span>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="timezone">
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    className="select"
                    value={preferences.timezone}
                    onChange={(event) =>
                      updatePreference('timezone', event.target.value)
                    }
                  >
                    {timezoneOptions.map((timezone) => (
                      <option value={timezone} key={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Used for payment due dates and reminders.
                  </span>
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="theme">
                  Appearance
                </label>
                <select
                  id="theme"
                  className="select"
                  value={preferences.theme}
                  onChange={(event) =>
                    updatePreference(
                      'theme',
                      event.target.value as ThemePreference,
                    )
                  }
                >
                  <option value="system">Match system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
                <span className="field-hint">
                  Saved changes apply across the app immediately.
                </span>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="notifications-title">
            <div className="section-heading">
              <h2 id="notifications-title">Notifications</h2>
              <p>
                Choose which updates you would like to receive once alerts are
                introduced. Nothing is sent in Phase 1.
              </p>
            </div>

            <Switch
              label="Email notifications"
              description="Important account and payment updates."
              checked={Boolean(preferences.email_notifications)}
              onChange={(checked) =>
                updatePreference('email_notifications', checked)
              }
            />
            <Switch
              label="Push notifications"
              description="Mobile alerts for upcoming payments and forecasts."
              checked={Boolean(preferences.push_notifications)}
              onChange={(checked) =>
                updatePreference('push_notifications', checked)
              }
            />
            <Switch
              label="Weekly summary"
              description="A calm weekly overview of your financial position."
              checked={Boolean(preferences.weekly_summary)}
              onChange={(checked) =>
                updatePreference('weekly_summary', checked)
              }
            />
          </section>

          <div className="form-actions">
            <Button type="submit" loading={saving}>
              {saving ? 'Saving…' : 'Save preferences'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={resetPreferences}
            >
              Discard changes
            </Button>
          </div>
        </div>

        <aside className="form-page-side">
          <section className="card">
            <div className="inline" style={{ marginBottom: 14 }}>
              <span className="feature-icon">
                <GlobeIcon size={18} />
              </span>
              <h2 className="card-title">One account, two apps</h2>
            </div>
            <p className="muted-note" style={{ lineHeight: 1.65 }}>
              The web and mobile apps use the same Guardian account. Saving here
              updates the preference stored on the backend, so your next mobile
              session reflects the same choices.
            </p>
          </section>

          <section className="card">
            <div className="inline" style={{ marginBottom: 14 }}>
              <span className="feature-icon">
                <BellIcon size={18} />
              </span>
              <h2 className="card-title">Alerts arrive later</h2>
            </div>
            <p className="muted-note" style={{ lineHeight: 1.65 }}>
              Notification delivery, bill reminders and low-balance alerts are
              part of Phase 5. Your choices now are stored as preferences and do
              not trigger messages.
            </p>
          </section>

          <section className="card card-muted">
            <div className="inline" style={{ marginBottom: 12 }}>
              <ShieldCheckIcon size={18} />
              <h2 className="card-title">Safety reminders</h2>
            </div>
            <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>
              <li className="muted-note">
                <LockIcon size={12} /> Guardian never asks for banking
                credentials.
              </li>
              <li className="muted-note">
                <MailIcon size={12} /> Verify unexpected account emails through
                the app.
              </li>
            </ul>
          </section>
        </aside>
      </form>
    </>
  )
}
