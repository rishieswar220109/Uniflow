import { useCallback, useEffect, useState, type FormEvent } from 'react'

import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  InfoIcon,
} from '../components/icons'
import { StatusBadge } from '../components/finance/StatusBadge'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type { Bill, BillInput, BillRecurrence, Payment } from '../services/types'
import { extractApiError } from '../utils/errors'
import {
  describeDueDate,
  formatMoney,
  formatShortDate,
  todayInputValue,
} from '../utils/format'

const STATE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'due', label: 'Due today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'skipped', label: 'Skipped' },
]

const RECURRENCES: { value: BillRecurrence; label: string }[] = [
  { value: 'none', label: 'One-off' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

interface BillFormState {
  name: string
  payee: string
  amount: string
  due_date: string
  recurrence: BillRecurrence
  autopay: boolean
  reminder_days_before: string
  notes: string
}

function emptyForm(): BillFormState {
  return {
    name: '',
    payee: '',
    amount: '',
    due_date: todayInputValue(),
    recurrence: 'none',
    autopay: false,
    reminder_days_before: '3',
    notes: '',
  }
}

function formFromBill(bill: Bill): BillFormState {
  return {
    name: bill.name,
    payee: bill.payee ?? '',
    amount: bill.amount,
    due_date: bill.due_date,
    recurrence: (RECURRENCES.some(
      (option) => option.value === bill.recurrence,
    )
      ? bill.recurrence
      : 'none') as BillRecurrence,
    autopay: bill.autopay,
    reminder_days_before: String(bill.reminder_days_before),
    notes: bill.notes ?? '',
  }
}

export function BillsPage() {
  useDocumentTitle('Bills')

  const [bills, setBills] = useState<Bill[]>([])
  const [total, setTotal] = useState(0)
  const [state, setState] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BillFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [historyId, setHistoryId] = useState<string | null>(null)
  const [history, setHistory] = useState<Payment[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const load = useCallback(async () => {
    const result = await financeApi.getBills({
      state: state || undefined,
      search: search || undefined,
      days: 90,
    })
    setBills(result.items)
    setTotal(result.total)
  }, [state, search])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        await load()
      } catch (loadError) {
        if (!cancelled) {
          setError(extractApiError(loadError, 'Unable to load your bills.'))
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

  function openEdit(bill: Bill) {
    setForm(formFromBill(bill))
    setEditingId(bill.id)
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
    const payload: BillInput = {
      name: form.name,
      payee: form.payee || null,
      amount: form.amount,
      due_date: form.due_date,
      recurrence: form.recurrence,
      autopay: form.autopay,
      reminder_days_before: Number(form.reminder_days_before) || 0,
      notes: form.notes || null,
    }
    try {
      if (formMode === 'edit' && editingId) {
        await financeApi.updateBill(editingId, payload)
        setSuccess('Bill updated.')
      } else {
        await financeApi.createBill(payload)
        setSuccess('Bill created.')
      }
      setFormMode(null)
      setEditingId(null)
      await load()
    } catch (submitError) {
      setError(extractApiError(submitError, 'Unable to save the bill.'))
    } finally {
      setSaving(false)
    }
  }

  async function handlePay(bill: Bill) {
    if (
      !window.confirm(
        `Record a payment of ${formatMoney(bill.amount, bill.currency)} for ` +
          `“${bill.name}” today?`,
      )
    ) {
      return
    }
    setBusyId(bill.id)
    setError('')
    setSuccess('')
    try {
      const result = await financeApi.payBill(bill.id, {
        paid_on: todayInputValue(),
      })
      setSuccess(
        result.recurrence === 'none'
          ? `“${bill.name}” marked as paid.`
          : `Payment recorded. The next “${bill.name}” occurrence is due ` +
              `${formatShortDate(result.due_date)}.`,
      )
      await load()
      if (historyId === bill.id) {
        const payments = await financeApi.getBillPayments(bill.id)
        setHistory(payments)
      }
    } catch (payError) {
      setError(extractApiError(payError, 'Unable to record the payment.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(bill: Bill) {
    if (
      !window.confirm(
        `Delete “${bill.name}”? Its recorded payment history will also be ` +
          'removed.',
      )
    ) {
      return
    }
    setBusyId(bill.id)
    setError('')
    setSuccess('')
    try {
      await financeApi.deleteBill(bill.id)
      setSuccess('Bill deleted.')
      if (historyId === bill.id) {
        setHistoryId(null)
        setHistory([])
      }
      await load()
    } catch (deleteError) {
      setError(extractApiError(deleteError, 'Unable to delete the bill.'))
    } finally {
      setBusyId(null)
    }
  }

  async function toggleHistory(bill: Bill) {
    if (historyId === bill.id) {
      setHistoryId(null)
      setHistory([])
      return
    }
    setHistoryId(bill.id)
    setHistory([])
    setHistoryLoading(true)
    try {
      const payments = await financeApi.getBillPayments(bill.id)
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
          <span className="page-kicker">Obligations</span>
          <h1 className="page-title">Bills</h1>
          <p className="page-subtitle">
            Track one-off and recurring bills, record payments and see what is
            due next. Paying a recurring bill advances its schedule instead of
            marking it permanently paid.
          </p>
        </div>
        <Button onClick={openCreate}>
          <CalendarIcon size={16} />
          New bill
        </Button>
      </header>

      <div className="stack-lg">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        {formMode ? (
          <section className="card" aria-labelledby="bill-form-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="bill-form-title">
                  {formMode === 'edit' ? 'Edit bill' : 'Create a bill'}
                </h2>
                <p className="card-subtitle">
                  Amounts are stored with two decimals. Recurring bills keep
                  their cadence until you change or delete them.
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
                  label="Bill name"
                  id="bill-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Electricity bill"
                  required
                />
                <Input
                  label="Payee"
                  id="bill-payee"
                  value={form.payee}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      payee: event.target.value,
                    }))
                  }
                  placeholder="State Power"
                />
              </div>

              <div className="form-row">
                <Input
                  label="Amount"
                  id="bill-amount"
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
                  placeholder="1450.00"
                  required
                />
                <Input
                  label="Due date"
                  id="bill-due"
                  type="date"
                  value={form.due_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      due_date: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label className="field-label" htmlFor="bill-recurrence">
                    Recurrence
                  </label>
                  <select
                    id="bill-recurrence"
                    className="select"
                    value={form.recurrence}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        recurrence: event.target.value as BillRecurrence,
                      }))
                    }
                  >
                    {RECURRENCES.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Reminder days before"
                  id="bill-reminder"
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
              </div>

              <Input
                label="Notes"
                id="bill-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Optional context"
              />

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.autopay}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      autopay: event.target.checked,
                    }))
                  }
                />
                <span>
                  Mark as autopay
                  <span className="cell-sub">
                    UniFlow does not execute payments; this is a label only.
                  </span>
                </span>
              </label>

              <div className="form-actions">
                <Button type="submit" loading={saving}>
                  <CheckIcon size={16} />
                  {saving ? 'Saving…' : 'Save bill'}
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

        <section className="card" aria-labelledby="bill-filter-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="bill-filter-title">
                Find bills
              </h2>
              <p className="card-subtitle">
                Overdue and due-today states are derived from stored due dates.
              </p>
            </div>
            <span className="badge badge-neutral badge-plain">{total} bill(s)</span>
          </div>

          <div className="chip-row" role="group" aria-label="Filter bills">
            {STATE_FILTERS.map((option) => (
              <button
                type="button"
                key={option.value || 'all'}
                className={
                  state === option.value ? 'chip chip-active' : 'chip'
                }
                onClick={() => setState(option.value)}
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
              aria-label="Search bills"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search by name or payee"
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

        <section aria-labelledby="bill-list-title">
          <div className="section-heading">
            <h2 id="bill-list-title">Your bills</h2>
            <p>Record a payment as soon as it is made to keep history accurate.</p>
          </div>

          {loading ? (
            <div className="page-loader">Loading bills…</div>
          ) : bills.length === 0 ? (
            <div className="card empty-finance">
              <span className="empty-art">
                <BellIcon size={30} />
              </span>
              <h3>No bills here</h3>
              <p>
                Create a bill to track its due date, recurrence and payment
                history. UniFlow never pays a bill without your approval.
              </p>
              <Button onClick={openCreate}>Create your first bill</Button>
            </div>
          ) : (
            <div className="stack">
              {bills.map((bill) => (
                <article className="card obligation-card" key={bill.id}>
                  <div className="obligation-head">
                    <span className="obligation-icon">
                      <CalendarIcon size={18} />
                    </span>
                    <div className="obligation-copy">
                      <div className="inline">
                        <h3 className="obligation-title">{bill.name}</h3>
                        <StatusBadge status={bill.state} />
                        {bill.autopay ? (
                          <span className="badge badge-neutral badge-plain">
                            Autopay label
                          </span>
                        ) : null}
                      </div>
                      <p className="obligation-sub">
                        {bill.payee ? `${bill.payee} · ` : ''}
                        Due {formatShortDate(bill.due_date)} ·{' '}
                        {describeDueDate(bill.due_date)}
                        {bill.recurrence !== 'none'
                          ? ` · ${bill.recurrence}`
                          : ' · one-off'}
                      </p>
                    </div>
                    <div className="obligation-amount">
                      <strong>{formatMoney(bill.amount, bill.currency)}</strong>
                      <span>{bill.currency}</span>
                    </div>
                  </div>

                  {bill.notes ? (
                    <p className="muted-note">{bill.notes}</p>
                  ) : null}

                  <div className="obligation-actions">
                    <Button
                      size="sm"
                      loading={busyId === bill.id}
                      disabled={
                        busyId !== null ||
                        ['paid', 'cancelled', 'skipped'].includes(bill.status)
                      }
                      onClick={() => void handlePay(bill)}
                    >
                      <CheckIcon size={15} />
                      Record payment
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId !== null}
                      onClick={() => openEdit(bill)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId !== null}
                      onClick={() => void toggleHistory(bill)}
                    >
                      <ClockIcon size={15} />
                      {historyId === bill.id ? 'Hide history' : 'History'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId !== null}
                      onClick={() => void handleDelete(bill)}
                    >
                      Delete
                    </Button>
                  </div>

                  {historyId === bill.id ? (
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
            UniFlow records payments you confirm; it never initiates a bank
            transfer in this phase. Use the upcoming calendar to see bills and
            subscriptions together.
          </span>
        </div>
      </div>
    </>
  )
}
