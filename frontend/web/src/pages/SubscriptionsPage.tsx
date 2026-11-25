import { useCallback, useEffect, useState, type FormEvent } from 'react'

import {
  CheckIcon,
  ClockIcon,
  InfoIcon,
  SparklesIcon,
} from '../components/icons'
import { StatusBadge } from '../components/finance/StatusBadge'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type {
  BillingCycle,
  Payment,
  Subscription,
  SubscriptionInput,
} from '../services/types'
import { extractApiError } from '../utils/errors'
import {
  describeDueDate,
  formatMoney,
  formatShortDate,
  todayInputValue,
} from '../utils/format'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
]

const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

interface SubscriptionFormState {
  name: string
  provider: string
  amount: string
  billing_cycle: BillingCycle
  next_payment_date: string
  started_on: string
  reminder_days_before: string
  notes: string
}

function emptyForm(): SubscriptionFormState {
  return {
    name: '',
    provider: '',
    amount: '',
    billing_cycle: 'monthly',
    next_payment_date: todayInputValue(),
    started_on: '',
    reminder_days_before: '3',
    notes: '',
  }
}

function formFromSubscription(
  subscription: Subscription,
): SubscriptionFormState {
  return {
    name: subscription.name,
    provider: subscription.provider ?? '',
    amount: subscription.amount,
    billing_cycle: (BILLING_CYCLES.some(
      (option) => option.value === subscription.billing_cycle,
    )
      ? subscription.billing_cycle
      : 'monthly') as BillingCycle,
    next_payment_date: subscription.next_payment_date,
    started_on: subscription.started_on ?? '',
    reminder_days_before: String(subscription.reminder_days_before),
    notes: subscription.notes ?? '',
  }
}

export function SubscriptionsPage() {
  useDocumentTitle('Subscriptions')

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SubscriptionFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [historyId, setHistoryId] = useState<string | null>(null)
  const [history, setHistory] = useState<Payment[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const load = useCallback(async () => {
    const result = await financeApi.getSubscriptions({
      status: status || undefined,
      search: search || undefined,
    })
    setSubscriptions(result.items)
    setTotal(result.total)
  }, [status, search])

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
              'Unable to load your subscriptions.',
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

  function openCreate() {
    setForm(emptyForm())
    setEditingId(null)
    setFormMode('create')
    setError('')
    setSuccess('')
  }

  function openEdit(subscription: Subscription) {
    setForm(formFromSubscription(subscription))
    setEditingId(subscription.id)
    setFormMode('edit')
    setError('')
    setSuccess('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    setSuccess('')
    const payload: SubscriptionInput = {
      name: form.name,
      provider: form.provider || null,
      amount: form.amount,
      billing_cycle: form.billing_cycle,
      next_payment_date: form.next_payment_date,
      started_on: form.started_on || null,
      reminder_days_before: Number(form.reminder_days_before) || 0,
      notes: form.notes || null,
    }
    try {
      if (formMode === 'edit' && editingId) {
        await financeApi.updateSubscription(editingId, payload)
        setSuccess('Subscription updated.')
      } else {
        await financeApi.createSubscription(payload)
        setSuccess('Subscription created.')
      }
      setFormMode(null)
      setEditingId(null)
      await load()
    } catch (submitError) {
      setError(
        extractApiError(submitError, 'Unable to save the subscription.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handlePay(subscription: Subscription) {
    if (
      !window.confirm(
        `Record a payment of ` +
          `${formatMoney(subscription.amount, subscription.currency)} for ` +
          `“${subscription.name}” today?`,
      )
    ) {
      return
    }
    setBusyId(subscription.id)
    setError('')
    setSuccess('')
    try {
      const result = await financeApi.paySubscription(subscription.id, {
        paid_on: todayInputValue(),
      })
      setSuccess(
        `Payment recorded. The next “${subscription.name}” charge is expected ` +
          `on ${formatShortDate(result.next_payment_date)}.`,
      )
      await load()
      if (historyId === subscription.id) {
        const payments = await financeApi.getSubscriptionPayments(
          subscription.id,
        )
        setHistory(payments)
      }
    } catch (payError) {
      setError(extractApiError(payError, 'Unable to record the payment.'))
    } finally {
      setBusyId(null)
    }
  }

  async function changeStatus(
    subscription: Subscription,
    nextStatus: 'active' | 'paused',
  ) {
    setBusyId(subscription.id)
    setError('')
    setSuccess('')
    try {
      await financeApi.updateSubscription(subscription.id, {
        status: nextStatus,
      })
      setSuccess(
        nextStatus === 'paused'
          ? `“${subscription.name}” paused.`
          : `“${subscription.name}” resumed.`,
      )
      await load()
    } catch (statusError) {
      setError(
        extractApiError(statusError, 'Unable to change the subscription.'),
      )
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(subscription: Subscription) {
    if (
      !window.confirm(
        `Delete “${subscription.name}”? Its recorded payment history will ` +
          'also be removed.',
      )
    ) {
      return
    }
    setBusyId(subscription.id)
    setError('')
    setSuccess('')
    try {
      await financeApi.deleteSubscription(subscription.id)
      setSuccess('Subscription deleted.')
      if (historyId === subscription.id) {
        setHistoryId(null)
        setHistory([])
      }
      await load()
    } catch (deleteError) {
      setError(
        extractApiError(deleteError, 'Unable to delete the subscription.'),
      )
    } finally {
      setBusyId(null)
    }
  }

  async function toggleHistory(subscription: Subscription) {
    if (historyId === subscription.id) {
      setHistoryId(null)
      setHistory([])
      return
    }
    setHistoryId(subscription.id)
    setHistory([])
    setHistoryLoading(true)
    try {
      const payments = await financeApi.getSubscriptionPayments(
        subscription.id,
      )
      setHistory(payments)
    } catch (historyError) {
      setError(
        extractApiError(historyError, 'Unable to load payment history.'),
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Recurring services</span>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-subtitle">
            See what you pay regularly, when the next charge is expected and
            what each plan costs per month. UniFlow suggests candidates from
            transaction history but never creates a subscription for you.
          </p>
        </div>
        <Button onClick={openCreate}>
          <SparklesIcon size={16} />
          New subscription
        </Button>
      </header>

      <div className="stack-lg">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        {formMode ? (
          <section className="card" aria-labelledby="subscription-form-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="subscription-form-title">
                  {formMode === 'edit'
                    ? 'Edit subscription'
                    : 'Create a subscription'}
                </h2>
                <p className="card-subtitle">
                  Billing cycles are normalised to a monthly equivalent for
                  comparison.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFormMode(null)
                  setEditingId(null)
                }}
              >
                Close
              </Button>
            </div>

            <form className="form-stack" onSubmit={handleSubmit}>
              <div className="form-row">
                <Input
                  label="Subscription name"
                  id="subscription-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Netflix"
                  required
                />
                <Input
                  label="Provider"
                  id="subscription-provider"
                  value={form.provider}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      provider: event.target.value,
                    }))
                  }
                  placeholder="Netflix India"
                />
              </div>

              <div className="form-row">
                <Input
                  label="Amount per cycle"
                  id="subscription-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="649.00"
                  required
                />
                <div className="field">
                  <label
                    className="field-label"
                    htmlFor="subscription-cycle"
                  >
                    Billing cycle
                  </label>
                  <select
                    id="subscription-cycle"
                    className="select"
                    value={form.billing_cycle}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        billing_cycle: event.target.value as BillingCycle,
                      }))
                    }
                  >
                    {BILLING_CYCLES.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <Input
                  label="Next payment date"
                  id="subscription-next"
                  type="date"
                  value={form.next_payment_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      next_payment_date: event.target.value,
                    }))
                  }
                  required
                />
                <Input
                  label="Started on"
                  id="subscription-started"
                  type="date"
                  value={form.started_on}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      started_on: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-row">
                <Input
                  label="Reminder days before"
                  id="subscription-reminder"
                  type="number"
                  min="0"
                  max="60"
                  value={form.reminder_days_before}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reminder_days_before: event.target.value,
                    }))
                  }
                  hint="Reminders are delivered in a later phase."
                />
                <Input
                  label="Notes"
                  id="subscription-notes"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Plan, seats or cancellation terms"
                />
              </div>

              <div className="form-actions">
                <Button type="submit" loading={saving}>
                  <CheckIcon size={16} />
                  {saving ? 'Saving…' : 'Save subscription'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => {
                    setFormMode(null)
                    setEditingId(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="card" aria-labelledby="subscription-filter-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="subscription-filter-title">
                Find subscriptions
              </h2>
              <p className="card-subtitle">
                Paused and cancelled plans stay in your history.
              </p>
            </div>
            <span className="badge badge-neutral badge-plain">
              {total} subscription(s)
            </span>
          </div>

          <div
            className="chip-row"
            role="group"
            aria-label="Filter subscriptions"
          >
            {STATUS_FILTERS.map((option) => (
              <button
                type="button"
                key={option.value || 'all'}
                className={
                  status === option.value ? 'chip chip-active' : 'chip'
                }
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <form
            className="inline-search"
            onSubmit={(event) => {
              event.preventDefault()
              setSearch(searchDraft)
            }}
          >
            <input
              className="input"
              aria-label="Search subscriptions"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search by name or provider"
            />
            <Button type="submit" size="sm" variant="secondary">
              Search
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchDraft('')
                setSearch('')
              }}
            >
              Clear
            </Button>
          </form>
        </section>

        <section aria-labelledby="subscription-list-title">
          <div className="section-heading">
            <h2 id="subscription-list-title">Your subscriptions</h2>
            <p>
              Monthly equivalent is shown for comparison, not as a charge.
            </p>
          </div>

          {loading ? (
            <div className="page-loader">Loading subscriptions…</div>
          ) : subscriptions.length === 0 ? (
            <div className="card empty-finance">
              <span className="empty-art">
                <SparklesIcon size={30} />
              </span>
              <h3>No subscriptions here</h3>
              <p>
                Add a recurring service to track charges and reminders, or use
                the upcoming page to review recurring suggestions from your
                synced transactions.
              </p>
              <Button onClick={openCreate}>Create your first subscription</Button>
            </div>
          ) : (
            <div className="stack">
              {subscriptions.map((subscription) => (
                <article className="card obligation-card" key={subscription.id}>
                  <div className="obligation-head">
                    <span className="obligation-icon">
                      <SparklesIcon size={18} />
                    </span>
                    <div className="obligation-copy">
                      <div className="inline">
                        <h3 className="obligation-title">
                          {subscription.name}
                        </h3>
                        <StatusBadge status={subscription.status} />
                        <span className="badge badge-neutral badge-plain">
                          {subscription.billing_cycle}
                        </span>
                      </div>
                      <p className="obligation-sub">
                        {subscription.provider
                          ? `${subscription.provider} · `
                          : ''}
                        Next charge {formatShortDate(subscription.next_payment_date)}{' '}
                        · {describeDueDate(subscription.next_payment_date)}
                        {subscription.started_on
                          ? ` · Since ${formatShortDate(subscription.started_on)}`
                          : ''}
                      </p>
                    </div>
                    <div className="obligation-amount">
                      <strong>
                        {formatMoney(subscription.amount, subscription.currency)}
                      </strong>
                      <span>
                        {formatMoney(
                          subscription.monthly_equivalent,
                          subscription.currency,
                        )}{' '}
                        / month
                      </span>
                    </div>
                  </div>

                  {subscription.notes ? (
                    <p className="muted-note">{subscription.notes}</p>
                  ) : null}

                  <div className="obligation-actions">
                    <Button
                      size="sm"
                      loading={busyId === subscription.id}
                      disabled={
                        busyId !== null || subscription.status !== 'active'
                      }
                      onClick={() => void handlePay(subscription)}
                    >
                      <CheckIcon size={15} />
                      Record payment
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId !== null}
                      onClick={() => openEdit(subscription)}
                    >
                      Edit
                    </Button>
                    {subscription.status === 'active' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId !== null}
                        onClick={() =>
                          void changeStatus(subscription, 'paused')
                        }
                      >
                        Pause
                      </Button>
                    ) : subscription.status === 'paused' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId !== null}
                        onClick={() =>
                          void changeStatus(subscription, 'active')
                        }
                      >
                        Resume
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId !== null}
                      onClick={() => void toggleHistory(subscription)}
                    >
                      <ClockIcon size={15} />
                      {historyId === subscription.id
                        ? 'Hide history'
                        : 'History'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId !== null}
                      onClick={() => void handleDelete(subscription)}
                    >
                      Delete
                    </Button>
                  </div>

                  {historyId === subscription.id ? (
                    <div className="history-panel">
                      {historyLoading ? (
                        <span className="muted-note">Loading history…</span>
                      ) : history.length === 0 ? (
                        <span className="muted-note">
                          No payments recorded yet.
                        </span>
                      ) : (
                        <ul className="history-list">
                          {history.map((payment) => (
                            <li key={payment.id}>
                              <span>
                                {formatShortDate(payment.paid_on)}
                                {payment.note ? ` · ${payment.note}` : ''}
                              </span>
                              <strong>
                                {formatMoney(
                                  payment.amount,
                                  payment.currency,
                                )}
                              </strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="settings-note">
          <InfoIcon size={15} />
          <span>
            Recording a payment advances the next charge date and keeps the
            entry in history. Subscription tracking is informational; no
            cancellation is sent to the provider.
          </span>
        </div>
      </div>
    </>
  )
}
