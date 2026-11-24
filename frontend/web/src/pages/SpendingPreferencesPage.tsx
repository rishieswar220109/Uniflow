import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { BellIcon, SparklesIcon } from '../components/icons'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Switch } from '../components/ui/Switch'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type {
  SpendingPreferences,
  SpendingPreferencesUpdate,
} from '../services/types'
import { extractApiError } from '../utils/errors'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED']

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'none', label: 'Do not repeat' },
]

type FormState = {
  proactive_awareness_enabled: boolean
  significant_spending_threshold: string
  reminder_advance_days: string
  enable_due_reminders: boolean
  enable_post_payment_reminders: boolean
  enable_entertainment_alerts: boolean
  entertainment_categories: string
  reminder_frequency: string
  currency: string
}

function formFrom(preferences: SpendingPreferences): FormState {
  return {
    proactive_awareness_enabled: preferences.proactive_awareness_enabled,
    significant_spending_threshold: preferences.significant_spending_threshold,
    reminder_advance_days: String(preferences.reminder_advance_days),
    enable_due_reminders: preferences.enable_due_reminders,
    enable_post_payment_reminders: preferences.enable_post_payment_reminders,
    enable_entertainment_alerts: preferences.enable_entertainment_alerts,
    entertainment_categories: preferences.entertainment_categories,
    reminder_frequency: preferences.reminder_frequency,
    currency: preferences.currency,
  }
}

function validate(form: FormState): string {
  const threshold = Number(form.significant_spending_threshold)
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return 'Enter a significant spending threshold greater than zero.'
  }
  const advance = Number(form.reminder_advance_days)
  if (
    !Number.isInteger(advance) ||
    advance < 0 ||
    advance > 30
  ) {
    return 'Advance reminder days must be a whole number between 0 and 30.'
  }
  if (form.entertainment_categories.trim().length > 200) {
    return 'Enter at most 200 characters of entertainment categories.'
  }
  if (!/^[A-Z]{3}$/.test(form.currency)) {
    return 'Choose a valid three-letter currency code.'
  }
  return ''
}

export function SpendingPreferencesPage() {
  useDocumentTitle('Spending preferences')

  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    const preferences = await financeApi.getSpendingPreferences()
    setForm(formFrom(preferences))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        await load()
      } catch (loadError) {
        if (!cancelled) {
          setError(
            extractApiError(
              loadError,
              'Unable to load your spending preferences.',
            ),
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [load])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
    setSuccess('')
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form || saving) return
    const validationError = validate(form)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload: SpendingPreferencesUpdate = {
        proactive_awareness_enabled: form.proactive_awareness_enabled,
        significant_spending_threshold: Number(
          form.significant_spending_threshold,
        ).toFixed(2),
        reminder_advance_days: Number(form.reminder_advance_days),
        enable_due_reminders: form.enable_due_reminders,
        enable_post_payment_reminders: form.enable_post_payment_reminders,
        enable_entertainment_alerts: form.enable_entertainment_alerts,
        entertainment_categories: form.entertainment_categories.trim(),
        reminder_frequency: form.reminder_frequency,
        currency: form.currency,
      }
      const updated = await financeApi.updateSpendingPreferences(payload)
      setForm(formFrom(updated))
      setSuccess('Spending preferences saved.')
    } catch (submitError) {
      setError(
        extractApiError(
          submitError,
          'Unable to save your spending preferences.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="page-loader">Loading spending preferences…</div>
  }

  if (!form) {
    return (
      <div className="stack-lg">
        <Alert variant="error">
          {error || 'Unable to load your spending preferences.'}
        </Alert>
      </div>
    )
  }

  const currencyOptions = CURRENCIES.includes(form.currency)
    ? CURRENCIES
    : [form.currency, ...CURRENCIES]

  const frequencyOptions = FREQUENCIES.some(
    (item) => item.value === form.reminder_frequency,
  )
    ? FREQUENCIES
    : [
        ...FREQUENCIES,
        { value: form.reminder_frequency, label: form.reminder_frequency },
      ]

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Proactive spending awareness</span>
          <h1 className="page-title">Spending preferences</h1>
          <p className="page-subtitle">
            Choose how UniFlow warns you before and after significant spending.
            These preferences are stored on your account and shared with the
            mobile app.
          </p>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/intelligence">
          Financial intelligence
        </Link>
      </header>

      <form className="form-page-grid" onSubmit={handleSubmit}>
        <div className="form-page-main">
          {error ? (
            <div style={{ marginBottom: 18 }}>
              <Alert variant="error">{error}</Alert>
            </div>
          ) : null}
          {success ? (
            <div style={{ marginBottom: 18 }}>
              <Alert variant="success">{success}</Alert>
            </div>
          ) : null}

          <section className="card" aria-labelledby="awareness-title">
            <div className="section-heading">
              <h2 id="awareness-title">Awareness</h2>
              <p>
                Checks are advisory. UniFlow never blocks or intercepts a
                payment.
              </p>
            </div>

            <Switch
              label="Proactive awareness"
              description="Surface upcoming dues before a significant transaction is recorded."
              checked={form.proactive_awareness_enabled}
              onChange={(checked) =>
                update('proactive_awareness_enabled', checked)
              }
            />
            <Switch
              label="Due-date reminders"
              description="Remind me about bills and subscriptions approaching their due date."
              checked={form.enable_due_reminders}
              onChange={(checked) => update('enable_due_reminders', checked)}
            />
            <Switch
              label="Post-payment reminders"
              description="Show a follow-up when a recorded payment changes your balance materially."
              checked={form.enable_post_payment_reminders}
              onChange={(checked) =>
                update('enable_post_payment_reminders', checked)
              }
            />
            <Switch
              label="Entertainment spending alerts"
              description="Warn about large spends in the entertainment categories below."
              checked={form.enable_entertainment_alerts}
              onChange={(checked) =>
                update('enable_entertainment_alerts', checked)
              }
            />
          </section>

          <section className="card" aria-labelledby="thresholds-title">
            <div className="section-heading">
              <h2 id="thresholds-title">Thresholds &amp; timing</h2>
              <p>
                Amounts above the threshold are treated as significant spending.
              </p>
            </div>

            <div className="form-stack">
              <div className="form-row">
                <Input
                  label="Significant spending threshold"
                  id="significant-threshold"
                  type="number"
                  step="0.01"
                  value={form.significant_spending_threshold}
                  onChange={(event) =>
                    update('significant_spending_threshold', event.target.value)
                  }
                  hint="Compared against the amount of each transaction."
                />
                <div className="field">
                  <label className="field-label" htmlFor="awareness-currency">
                    Currency
                  </label>
                  <select
                    id="awareness-currency"
                    className="select"
                    value={form.currency}
                    onChange={(event) =>
                      update('currency', event.target.value)
                    }
                  >
                    {currencyOptions.map((currency) => (
                      <option value={currency} key={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Thresholds are stored in this currency.
                  </span>
                </div>
              </div>

              <div className="form-row">
                <Input
                  label="Advance reminder days"
                  id="reminder-advance-days"
                  type="number"
                  step="1"
                  value={form.reminder_advance_days}
                  onChange={(event) =>
                    update('reminder_advance_days', event.target.value)
                  }
                  hint="How many days before a due date to raise it. 0–30."
                />
                <div className="field">
                  <label className="field-label" htmlFor="reminder-frequency">
                    Reminder frequency
                  </label>
                  <select
                    id="reminder-frequency"
                    className="select"
                    value={form.reminder_frequency}
                    onChange={(event) =>
                      update('reminder_frequency', event.target.value)
                    }
                  >
                    {frequencyOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    How often a reminder may repeat while it still applies.
                  </span>
                </div>
              </div>

              <Input
                label="Entertainment categories"
                id="entertainment-categories"
                value={form.entertainment_categories}
                onChange={(event) =>
                  update('entertainment_categories', event.target.value)
                }
                placeholder="Entertainment, Dining, Streaming"
                hint="Comma-separated category names, up to 200 characters."
              />
            </div>
          </section>

          <div className="form-actions">
            <Button type="submit" loading={saving}>
              {saving ? 'Saving…' : 'Save spending preferences'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setError('')
                setSuccess('')
                void load().catch((loadError: unknown) => {
                  setError(
                    extractApiError(
                      loadError,
                      'Unable to reload your spending preferences.',
                    ),
                  )
                })
              }}
            >
              Discard changes
            </Button>
          </div>
        </div>

        <aside className="form-page-side">
          <section className="card">
            <div className="inline" style={{ marginBottom: 14 }}>
              <span className="feature-icon">
                <SparklesIcon size={18} />
              </span>
              <h2 className="card-title">Advisory, not automated</h2>
            </div>
            <p className="muted-note" style={{ lineHeight: 1.65 }}>
              The proactive-awareness check returns advice for a proposed
              transaction. It does not block, intercept or execute payments, and
              no reminder message is delivered yet.
            </p>
          </section>

          <section className="card card-muted">
            <div className="inline" style={{ marginBottom: 12 }}>
              <BellIcon size={18} />
              <h2 className="card-title">Delivery arrives later</h2>
            </div>
            <p className="muted-note" style={{ lineHeight: 1.65 }}>
              Email, push and in-app notification delivery belongs to Phase 5.
              Your choices here are stored now and will be honoured then.
            </p>
          </section>
        </aside>
      </form>
    </>
  )
}
