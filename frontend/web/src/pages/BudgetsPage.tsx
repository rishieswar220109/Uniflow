import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { WalletIcon } from '../components/icons'
import { StatusBadge } from '../components/finance/StatusBadge'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type {
  Budget,
  BudgetCreate,
  BudgetSpending,
} from '../services/types'
import { extractApiError } from '../utils/errors'
import { formatMoney } from '../utils/format'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const

function monthBounds(monthsForward: number) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1 + monthsForward
  const startYear = month > 12 ? year + 1 : year
  const startMonth = month > 12 ? month - 12 : month
  const start = new Date(startYear, startMonth - 1, 1)
  const end = new Date(startYear, startMonth, 0)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export function BudgetsPage() {
  useDocumentTitle('Budgets')

  const [budgets, setBudgets] = useState<Budget[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BudgetCreate>({
    name: '',
    period_start: '',
    period_end: '',
    amount: '',
    currency: 'INR',
    alert_threshold: 80,
    is_active: true,
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const result = await financeApi.getBudgets({
      include_spending: true,
    })
    setBudgets(result.items)
    setTotal(result.total)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        await load()
      } catch (loadError) {
        if (!cancelled) {
          setError(extractApiError(loadError, 'Unable to load your budgets.'))
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
    const { start, end } = monthBounds(0)
    setForm({
      name: '',
      period_start: start,
      period_end: end,
      amount: '',
      currency: 'INR',
      alert_threshold: 80,
      is_active: true,
    })
    setEditingId(null)
    setFormMode('create')
    setError('')
    setSuccess('')
  }

  function openEdit(budget: Budget) {
    setForm({
      name: budget.name,
      period_start: budget.period_start,
      period_end: budget.period_end,
      amount: budget.amount,
      currency: budget.currency,
      alert_threshold: budget.alert_threshold,
      is_active: budget.is_active,
    })
    setEditingId(budget.id)
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
    try {
      if (formMode === 'edit' && editingId) {
        await financeApi.updateBudget(editingId, {
          name: form.name,
          period_start: form.period_start,
          period_end: form.period_end,
          amount: form.amount,
          currency: form.currency,
          alert_threshold: form.alert_threshold,
          is_active: form.is_active,
        })
        setSuccess('Budget updated.')
      } else {
        await financeApi.createBudget({
          name: form.name,
          period_start: form.period_start,
          period_end: form.period_end,
          amount: form.amount,
          currency: form.currency,
          alert_threshold: form.alert_threshold,
          is_active: form.is_active,
        })
        setSuccess('Budget created.')
      }
      setFormMode(null)
      setEditingId(null)
      await load()
    } catch (submitError) {
      setError(extractApiError(submitError, 'Unable to save the budget.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(budget: Budget) {
    setError('')
    setSuccess('')
    try {
      await financeApi.updateBudget(budget.id, {
        name: budget.name,
        period_start: budget.period_start,
        period_end: budget.period_end,
        amount: budget.amount,
        currency: budget.currency,
        alert_threshold: budget.alert_threshold,
        is_active: !budget.is_active,
      })
      setSuccess(
        budget.is_active ? 'Budget archived.' : 'Budget reactivated.',
      )
      await load()
    } catch (toggleError) {
      setError(extractApiError(toggleError, 'Unable to update the budget.'))
    }
  }

  async function deleteBudget(budget: Budget) {
    if (!window.confirm('Delete "' + budget.name + '"?')) return
    setError('')
    setSuccess('')
    try {
      await financeApi.deleteBudget(budget.id)
      setSuccess('Budget deleted.')
      await load()
    } catch (deleteError) {
      setError(extractApiError(deleteError, 'Unable to delete the budget.'))
    }
  }

  if (loading) return <div className="page-loader">Loading your budgets…</div>

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Budget planner</span>
          <h1 className="page-title">Budgets</h1>
          <p className="page-subtitle">
            Set monthly or category-based budgets and track actual spending
            against them. Spending is calculated from your stored transactions.
          </p>
        </div>
        <div className="inline">
          <Link className="btn btn-secondary btn-sm" to="/savings-goals">
            Savings goals
          </Link>
          <Button onClick={openCreate}>
            <WalletIcon size={16} />
            New budget
          </Button>
        </div>
      </header>

      <div className="stack-lg">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        <section aria-labelledby="budget-list-title">
          <div className="section-heading">
            <h2 id="budget-list-title">Your budgets</h2>
            <p>
              {total} budget(s). Overspending is flagged when actual spending
              exceeds the budget amount.
            </p>
          </div>

          {budgets.length === 0 ? (
            <div className="card empty-finance">
              <span className="empty-art">
                <WalletIcon size={30} />
              </span>
              <h3>No budgets yet</h3>
              <p>
                Create a budget to track spending against a target amount over
                a time period.
              </p>
              <Button onClick={openCreate}>Create your first budget</Button>
            </div>
          ) : (
            <div className="stack">
              {budgets.map((budget) => {
                const spending = budget as unknown as BudgetSpending
                const spent = Number(spending.spent ?? 0)
                const amount = Number(budget.amount)
                const remaining = amount - spent
                const overspending = spent > amount
                return (
                  <article
                    className="card obligation-card"
                    key={budget.id}
                  >
                    <div className="obligation-head">
                      <span className="obligation-icon">
                        <WalletIcon size={18} />
                      </span>
                      <div className="obligation-copy">
                        <div className="inline">
                          <h3 className="obligation-title">{budget.name}</h3>
                          <StatusBadge
                            status={budget.is_active ? 'active' : 'inactive'}
                            label={budget.is_active ? 'Active' : 'Archived'}
                          />
                          <span className="badge badge-neutral badge-plain">
                            {budget.period}
                          </span>
                        </div>
                        <p className="obligation-sub">
                          {formatMoney(budget.amount, budget.currency)} · Alert
                          at {budget.alert_threshold}%
                        </p>
                      </div>
                      <div className="obligation-amount">
                        <strong
                          className={
                            overspending
                              ? 'money money-negative'
                              : 'money money-positive'
                          }
                        >
                          {formatMoney(
                            Math.abs(remaining).toFixed(2),
                            budget.currency,
                          )}
                        </strong>
                        <span>{budget.currency}</span>
                      </div>
                    </div>

                    <div className="progress-row">
                      <span className="progress-label">Spent</span>
                      <span className="progress-value">
                        {formatMoney(spent.toFixed(2), budget.currency)} of {formatMoney(
                          amount.toFixed(2),
                          budget.currency,
                        )}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-bar"
                        style={{
                          width: Math.min(100, (spent / amount) * 100),
                          backgroundColor: overspending
                            ? '#dc2626'
                            : spent / amount >= budget.alert_threshold / 100
                            ? '#ca8a04'
                            : '#059669',
                        }}
                      />
                    </div>
                    <span className="progress-hint">
                      {overspending
                        ? 'Over budget'
                        : spent / amount >= budget.alert_threshold / 100
                        ? 'Approaching limit'
                        : 'On track'}
                    </span>

                    <div className="obligation-actions">
                      <Button
                        size="sm"
                        variant={budget.is_active ? 'secondary' : 'ghost'}
                        onClick={() => void toggleActive(budget)}
                      >
                        {budget.is_active ? 'Archive' : 'Reactivate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(budget)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => void deleteBudget(budget)}
                      >
                        Delete
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {formMode ? (
          <section className="card" aria-labelledby="budget-form-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="budget-form-title">
                  {formMode === 'edit' ? 'Edit budget' : 'Create a budget'}
                </h2>
                <p className="card-subtitle">
                  Spending is calculated from transactions stored in the
                  selected period. Category filters spending to that category.
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
                  label="Budget name"
                  id="budget-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Groceries monthly"
                  required
                />
                <Input
                  label="Amount"
                  id="budget-amount"
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
                  placeholder="8000.00"
                  required
                />
              </div>

              <div className="form-row">
                <Input
                  label="Period start"
                  id="budget-start"
                  type="date"
                  value={form.period_start}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      period_start: event.target.value,
                    }))
                  }
                  required
                />
                <Input
                  label="Period end"
                  id="budget-end"
                  type="date"
                  value={form.period_end}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      period_end: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label className="field-label" htmlFor="budget-currency">
                    Currency
                  </label>
                  <select
                    id="budget-currency"
                    className="select"
                    value={form.currency}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        currency: event.target.value,
                      }))
                    }
                  >
                    {CURRENCIES.map((currency) => (
                      <option value={currency} key={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="budget-threshold">
                    Alert threshold (%)
                  </label>
                  <Input
                    label="Alert threshold (%)"
                    id="budget-threshold"
                    type="number"
                    min="0"
                    max="100"
                    value={String(form.alert_threshold)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        alert_threshold: Number(event.target.value),
                      }))
                    }
                    hint="Flag when spending reaches this % of the budget."
                  />
                </div>
              </div>

              <div className="form-actions">
                <Button type="submit" loading={saving}>
                  <WalletIcon size={16} />
                  {saving ? 'Saving…' : 'Save budget'}
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
      </div>
    </>
  )
}
