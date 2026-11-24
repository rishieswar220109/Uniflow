import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { TargetIcon, WalletIcon } from '../components/icons'
import { StatusBadge } from '../components/finance/StatusBadge'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type {
  SavingsGoal,
  SavingsGoalCreate,
  SavingsGoalsSummary,
} from '../services/types'
import { extractApiError } from '../utils/errors'
import { formatMoney, formatShortDate } from '../utils/format'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED']

type GoalForm = {
  name: string
  target_amount: string
  current_amount: string
  currency: string
  target_date: string
  is_active: boolean
}

function emptyForm(currency: string): GoalForm {
  return {
    name: '',
    target_amount: '',
    current_amount: '0',
    currency,
    target_date: '',
    is_active: true,
  }
}

export function SavingsGoalsPage() {
  useDocumentTitle('Savings goals')

  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [summary, setSummary] = useState<SavingsGoalsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GoalForm>(() => emptyForm('INR'))

  const load = useCallback(async () => {
    const [page, totals] = await Promise.all([
      financeApi.getSavingsGoals({ limit: 100 }),
      financeApi.getSavingsGoalsSummary(),
    ])
    setGoals(page.items)
    setSummary(totals)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        await load()
      } catch (loadError) {
        if (!cancelled) {
          setError(extractApiError(loadError, 'Unable to load your savings goals.'))
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
    setForm(emptyForm(goals[0]?.currency ?? 'INR'))
    setEditingId(null)
    setFormMode('create')
    setError('')
    setSuccess('')
  }

  function openEdit(goal: SavingsGoal) {
    setForm({
      name: goal.name,
      target_amount: goal.target_amount,
      current_amount: goal.current_amount,
      currency: goal.currency,
      target_date: goal.target_date ?? '',
      is_active: goal.is_active,
    })
    setEditingId(goal.id)
    setFormMode('edit')
    setError('')
    setSuccess('')
  }

  function validate(current: GoalForm): string {
    if (!current.name.trim()) return 'Enter a name for the savings goal.'
    const target = Number(current.target_amount)
    if (!Number.isFinite(target) || target <= 0) {
      return 'Enter a target amount greater than zero.'
    }
    const saved = Number(current.current_amount)
    if (!Number.isFinite(saved) || saved < 0) {
      return 'The amount saved cannot be negative.'
    }
    return ''
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const validationError = validate(form)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const target = Number(form.target_amount).toFixed(2)
      if (formMode === 'edit' && editingId) {
        await financeApi.updateSavingsGoal(editingId, {
          name: form.name.trim(),
          target_amount: target,
          current_amount: Number(form.current_amount).toFixed(2),
          currency: form.currency,
          target_date: form.target_date || null,
          is_active: form.is_active,
        })
        setSuccess('Savings goal updated.')
      } else {
        const payload: SavingsGoalCreate = {
          name: form.name.trim(),
          target_amount: target,
          currency: form.currency,
          target_date: form.target_date || null,
          is_active: form.is_active,
        }
        await financeApi.createSavingsGoal(payload)
        setSuccess('Savings goal created.')
      }
      setFormMode(null)
      setEditingId(null)
      await load()
    } catch (submitError) {
      setError(extractApiError(submitError, 'Unable to save the savings goal.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(goal: SavingsGoal) {
    setError('')
    setSuccess('')
    try {
      await financeApi.updateSavingsGoal(goal.id, {
        name: goal.name,
        target_amount: goal.target_amount,
        currency: goal.currency,
        target_date: goal.target_date,
        current_amount: goal.current_amount,
        is_active: !goal.is_active,
      })
      setSuccess(goal.is_active ? 'Goal archived.' : 'Goal reactivated.')
      await load()
    } catch (toggleError) {
      setError(extractApiError(toggleError, 'Unable to update the goal.'))
    }
  }

  async function deleteGoal(goal: SavingsGoal) {
    if (!window.confirm('Delete "' + goal.name + '"?')) return
    setError('')
    setSuccess('')
    try {
      await financeApi.deleteSavingsGoal(goal.id)
      setSuccess('Savings goal deleted.')
      if (editingId === goal.id) {
        setFormMode(null)
        setEditingId(null)
      }
      await load()
    } catch (deleteError) {
      setError(extractApiError(deleteError, 'Unable to delete the goal.'))
    }
  }

  if (loading) return <div className="page-loader">Loading savings goals…</div>

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Budget planner</span>
          <h1 className="page-title">Savings goals</h1>
          <p className="page-subtitle">
            Set a target, record how much you have saved, and track progress.
            UniFlow never moves money between accounts.
          </p>
        </div>
        <div className="inline">
          <Link className="btn btn-secondary btn-sm" to="/budgets">
            Budgets
          </Link>
          <Button onClick={openCreate}>
            <TargetIcon size={16} />
            New goal
          </Button>
        </div>
      </header>

      <div className="stack-lg">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        {summary ? (
          <section className="stat-grid stat-grid-compact" aria-label="Savings totals">
            <div className="stat-card">
              <span className="stat-label">Goals</span>
              <strong className="stat-value">{summary.goal_count}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total target</span>
              <strong className="stat-value">
                {formatMoney(
                  summary.total_target,
                  summary.currency ?? goals[0]?.currency ?? 'INR',
                )}
              </strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Saved</span>
              <strong className="stat-value stat-value-positive">
                {formatMoney(
                  summary.total_saved,
                  summary.currency ?? goals[0]?.currency ?? 'INR',
                )}
              </strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Remaining</span>
              <strong className="stat-value">
                {formatMoney(
                  summary.remaining,
                  summary.currency ?? goals[0]?.currency ?? 'INR',
                )}
              </strong>
            </div>
          </section>
        ) : null}

        {summary?.currency_breakdown &&
        Object.keys(summary.currency_breakdown).length > 1 ? (
          <div className="settings-note">
            <WalletIcon size={15} />
            <span>
              Totals above cover only {summary.currency}.{' '}
              {Object.entries(summary.currency_breakdown)
                .filter(([code]) => code !== summary.currency)
                .map(
                  ([code, totals]) =>
                    `${code} ${formatMoney(totals.total_saved, code)} saved of ${formatMoney(
                      totals.total_target,
                      code,
                    )}`,
                )
                .join(' · ')}
              . Goals in different currencies are never added together.
            </span>
          </div>
        ) : null}

        <section aria-labelledby="savings-list-title">
          <div className="section-heading">
            <h2 id="savings-list-title">Your goals</h2>
            <p>
              Progress is computed by the backend from the amounts you record.
            </p>
          </div>

          {goals.length === 0 ? (
            <div className="card empty-finance">
              <span className="empty-art">
                <TargetIcon size={30} />
              </span>
              <h3>No savings goals yet</h3>
              <p>
                Create a goal to track progress towards a target amount. You can
                update the amount saved at any time.
              </p>
              <Button onClick={openCreate}>Create your first goal</Button>
            </div>
          ) : (
            <div className="stack">
              {goals.map((goal) => {
                const percent = Math.max(0, Math.min(100, goal.percent_funded))
                return (
                  <article className="card obligation-card" key={goal.id}>
                    <div className="obligation-head">
                      <span className="obligation-icon">
                        <TargetIcon size={18} />
                      </span>
                      <div className="obligation-copy">
                        <div className="inline">
                          <h3 className="obligation-title">{goal.name}</h3>
                          <StatusBadge
                            status={goal.is_active ? 'active' : 'inactive'}
                            label={goal.is_active ? 'Active' : 'Archived'}
                          />
                        </div>
                        <p className="obligation-sub">
                          {formatMoney(goal.current_amount, goal.currency)} of{' '}
                          {formatMoney(goal.target_amount, goal.currency)}
                          {goal.target_date
                            ? ` · target ${formatShortDate(goal.target_date)}`
                            : ''}
                        </p>
                      </div>
                      <div className="obligation-amount">
                        <strong className="money money-positive">
                          {goal.percent_funded.toFixed(1)}%
                        </strong>
                        <span>
                          {formatMoney(goal.remaining, goal.currency)} left
                        </span>
                      </div>
                    </div>

                    <div className="progress-track">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${percent}%`,
                          backgroundColor:
                            percent >= 100 ? '#059669' : '#2563eb',
                        }}
                      />
                    </div>
                    <span className="progress-hint">
                      {percent >= 100
                        ? 'Goal reached'
                        : `${percent.toFixed(1)}% funded`}
                    </span>

                    <div className="obligation-actions">
                      <Button
                        size="sm"
                        variant={goal.is_active ? 'secondary' : 'ghost'}
                        onClick={() => void toggleActive(goal)}
                      >
                        {goal.is_active ? 'Archive' : 'Reactivate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(goal)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => void deleteGoal(goal)}
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
          <section className="card" aria-labelledby="goal-form-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="goal-form-title">
                  {formMode === 'edit' ? 'Edit savings goal' : 'Create a savings goal'}
                </h2>
                <p className="card-subtitle">
                  The amount saved is recorded manually; it is not derived from
                  transactions.
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
                  label="Goal name"
                  id="goal-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Emergency fund"
                  required
                />
                <div className="field">
                  <label className="field-label" htmlFor="goal-currency">
                    Currency
                  </label>
                  <select
                    id="goal-currency"
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
              </div>

              <div className="form-row">
                <Input
                  label="Target amount"
                  id="goal-target"
                  type="number"
                  step="0.01"
                  value={form.target_amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      target_amount: event.target.value,
                    }))
                  }
                  placeholder="100000.00"
                />
                <Input
                  label="Amount saved"
                  id="goal-current"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.current_amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      current_amount: event.target.value,
                    }))
                  }
                  disabled={formMode === 'create'}
                  hint={
                    formMode === 'create'
                      ? 'New goals start at zero; update it after saving.'
                      : undefined
                  }
                />
              </div>

              <Input
                label="Target date (optional)"
                id="goal-target-date"
                type="date"
                value={form.target_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    target_date: event.target.value,
                  }))
                }
              />

              <div className="form-actions">
                <Button type="submit" loading={saving}>
                  <WalletIcon size={16} />
                  {saving ? 'Saving…' : 'Save goal'}
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
