import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  AlertCircleIcon,
  CheckIcon,
  InfoIcon,
  WalletIcon,
} from '../components/icons'
import { StatusBadge } from '../components/finance/StatusBadge'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type {
  Category,
  FinancialAccount,
  ProactiveAwareness,
  Transaction,
  TransactionPage,
} from '../services/types'
import { extractApiError } from '../utils/errors'
import {
  formatMoney,
  formatShortDate,
  formatSignedMoney,
  todayInputValue,
} from '../utils/format'

const PAGE_SIZE = 25

interface FilterState {
  account_id: string
  transaction_type: string
  source: string
  search: string
  from_date: string
  to_date: string
}

const EMPTY_FILTERS: FilterState = {
  account_id: '',
  transaction_type: '',
  source: '',
  search: '',
  from_date: '',
  to_date: '',
}

export function TransactionsPage() {
  useDocumentTitle('Transactions')

  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [page, setPage] = useState<TransactionPage | null>(null)
  const [offset, setOffset] = useState(0)
  const [draftFilters, setDraftFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkingAwareness, setCheckingAwareness] = useState(false)
  const [awareness, setAwareness] = useState<ProactiveAwareness | null>(null)
  const [form, setForm] = useState({
    account_id: '',
    amount: '',
    description: '',
    merchant: '',
    occurred_on: todayInputValue(),
    category_id: '',
    notes: '',
    allow_duplicate: false,
  })

  const [editing, setEditing] = useState<Transaction | null>(null)
  const [editCategory, setEditCategory] = useState('')
  const [editMerchant, setEditMerchant] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const loadTransactions = useCallback(async () => {
    const result = await financeApi.getTransactions({
      account_id: filters.account_id || undefined,
      transaction_type: filters.transaction_type || undefined,
      source: filters.source || undefined,
      search: filters.search || undefined,
      from_date: filters.from_date || undefined,
      to_date: filters.to_date || undefined,
      limit: PAGE_SIZE,
      offset,
    })
    setPage(result)
  }, [filters, offset])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const [accountList, categoryList] = await Promise.all([
          financeApi.getAccounts(),
          financeApi.getCategories(),
        ])
        if (cancelled) return
        setAccounts(accountList)
        setCategories(categoryList)
        setForm((current) => ({
          ...current,
          account_id: current.account_id || accountList[0]?.id || '',
        }))
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(
            extractApiError(
              bootstrapError,
              'Unable to load your transaction data.',
            ),
          )
        }
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const result = await financeApi.getTransactions({
          account_id: filters.account_id || undefined,
          transaction_type: filters.transaction_type || undefined,
          source: filters.source || undefined,
          search: filters.search || undefined,
          from_date: filters.from_date || undefined,
          to_date: filters.to_date || undefined,
          limit: PAGE_SIZE,
          offset,
        })
        if (!cancelled) setPage(result)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            extractApiError(loadError, 'Unable to load transactions.'),
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
  }, [filters, offset])

  const accountNames = useMemo(() => {
    return new Map(accounts.map((account) => [account.id, account.name]))
  }, [accounts])

  function applyFilters(event?: FormEvent) {
    event?.preventDefault()
    setOffset(0)
    setFilters(draftFilters)
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setOffset(0)
  }

  async function submitTransaction() {
    if (saving) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const created = await financeApi.createTransaction({
        account_id: form.account_id,
        amount: form.amount,
        description: form.description,
        merchant: form.merchant || null,
        occurred_on: form.occurred_on,
        category_id: form.category_id || null,
        notes: form.notes || null,
        allow_duplicate: form.allow_duplicate,
      })
      const alerts = created.alerts ?? []
      setSuccess(
        alerts.length > 0
          ? 'Transaction recorded. UniFlow stored ' +
              `${alerts.length} insight(s) for review: ` +
              `${alerts.map((alert) => alert.title).join('; ')}. ` +
              'No push, email or SMS notification is sent.'
          : 'Transaction recorded. Income and expenses update automatically ' +
              'from the sign of the amount.',
      )
      setAwareness(null)
      setForm((current) => ({
        ...current,
        amount: '',
        description: '',
        merchant: '',
        category_id: '',
        notes: '',
        allow_duplicate: false,
      }))
      setShowForm(false)
      await loadTransactions()
    } catch (createError) {
      setError(
        extractApiError(createError, 'Unable to record the transaction.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || checkingAwareness) return
    const amount = Number(form.amount)
    if (Number.isFinite(amount) && amount < 0) {
      setCheckingAwareness(true)
      setError('')
      try {
        const categorySlug = form.category_id
          ? categories.find((category) => category.id === form.category_id)
              ?.slug ?? null
          : null
        const result = await financeApi.checkProactiveAwareness({
          transaction_amount: Math.abs(amount).toFixed(2),
          transaction_category: categorySlug,
        })
        if (result) {
          setAwareness(result)
          setCheckingAwareness(false)
          return
        }
      } catch {
        // Spending awareness is advisory; a failure must never block storing
        // the transaction the user asked to record.
      }
      setCheckingAwareness(false)
    }
    await submitTransaction()
  }

  function startEditing(transaction: Transaction) {
    setEditing(transaction)
    setEditCategory(transaction.category?.id ?? '')
    setEditMerchant(transaction.merchant ?? '')
    setEditNotes(transaction.notes ?? '')
  }

  async function saveEditing() {
    if (!editing || editSaving) return
    setEditSaving(true)
    setError('')
    setSuccess('')
    try {
      await financeApi.updateTransaction(editing.id, {
        category_id: editCategory || null,
        merchant: editMerchant || null,
        notes: editNotes || null,
      })
      setSuccess('Transaction updated.')
      setEditing(null)
      await loadTransactions()
    } catch (updateError) {
      setError(
        extractApiError(updateError, 'Unable to update the transaction.'),
      )
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(transaction: Transaction) {
    if (
      !window.confirm(
        `Delete “${transaction.description}”? Manual transactions only.`,
      )
    ) {
      return
    }
    setError('')
    setSuccess('')
    try {
      await financeApi.deleteTransaction(transaction.id)
      setSuccess('Manual transaction deleted.')
      await loadTransactions()
    } catch (deleteError) {
      setError(
        extractApiError(deleteError, 'Unable to delete the transaction.'),
      )
    }
  }

  const total = page?.total ?? 0
  const items = page?.items ?? []
  const from = total === 0 ? 0 : offset + 1
  const to = offset + items.length

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Money in and out</span>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">
            Provider-synced and manually recorded activity in one place.
            Positive amounts are income; negative amounts are expenses. Synced
            records stay read-only except for categories and notes.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm((current) => !current)
            setAwareness(null)
          }}
        >
          {showForm ? 'Close form' : 'Add transaction'}
        </Button>
      </header>

      <div className="stack-lg">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        {showForm ? (
          <section className="card" aria-labelledby="add-transaction-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="add-transaction-title">
                  Record a manual transaction
                </h2>
                <p className="card-subtitle">
                  Use a negative amount for spending and a positive amount for
                  income. UniFlow prompts before storing an exact duplicate.
                </p>
              </div>
            </div>

            {accounts.length === 0 ? (
              <Alert variant="warning">
                Connect an account first so the transaction has an owner.
              </Alert>
            ) : (
              <form className="form-stack" onSubmit={handleCreate}>
                <div className="form-row">
                  <div className="field">
                    <label className="field-label" htmlFor="tx-account">
                      Account
                    </label>
                    <select
                      id="tx-account"
                      className="select"
                      value={form.account_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          account_id: event.target.value,
                        }))
                      }
                      required
                    >
                      {accounts.map((account) => (
                        <option value={account.id} key={account.id}>
                          {account.name} ({account.currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Amount"
                    id="tx-amount"
                    type="number"
                    step="0.01"
                    placeholder="-250.00"
                    hint="Negative for spending, positive for income."
                    value={form.amount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-row">
                  <Input
                    label="Description"
                    id="tx-description"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Local grocery store"
                    required
                  />
                  <Input
                    label="Merchant"
                    id="tx-merchant"
                    value={form.merchant}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        merchant: event.target.value,
                      }))
                    }
                    placeholder="Corner Shop"
                  />
                </div>

                <div className="form-row">
                  <Input
                    label="Date"
                    id="tx-date"
                    type="date"
                    value={form.occurred_on}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        occurred_on: event.target.value,
                      }))
                    }
                    required
                  />
                  <div className="field">
                    <label className="field-label" htmlFor="tx-category">
                      Category
                    </label>
                    <select
                      id="tx-category"
                      className="select"
                      value={form.category_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose automatically</option>
                      {categories.map((category) => (
                        <option value={category.id} key={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Input
                  label="Notes"
                  id="tx-notes"
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
                    checked={form.allow_duplicate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        allow_duplicate: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    Allow an exact duplicate if UniFlow reports one
                  </span>
                </label>

                {awareness ? (
                  <div className="card card-muted" role="status" aria-live="polite">
                    <div className="inline" style={{ marginBottom: 8 }}>
                      <AlertCircleIcon size={18} />
                      <strong>Spending awareness</strong>
                    </div>
                    <p className="muted-note">{awareness.advice}</p>
                    {awareness.insufficient_after_spending ? (
                      <Alert variant="warning">
                        After this spending you may not cover your upcoming
                        obligations.
                      </Alert>
                    ) : null}
                    {awareness.upcoming_dues.length > 0 ? (
                      <ul className="data-list">
                        {awareness.upcoming_dues.map((due) => (
                          <li
                            key={`${due.kind}-${due.id}`}
                            className="data-list-item"
                          >
                            <span className="cell-primary">{due.name}</span>
                            <span className="cell-sub">
                              {formatShortDate(due.due_date)}
                            </span>
                            <strong className="align-right money">
                              {formatMoney(due.amount, due.currency)}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="muted-note">
                      UniFlow is showing stored information for your review. It
                      does not block the transaction and sends no notification.
                    </p>
                    <div className="form-actions">
                      <Button
                        type="button"
                        loading={saving}
                        onClick={() => void submitTransaction()}
                      >
                        Record anyway
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => setAwareness(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="form-actions">
                  <Button type="submit" loading={saving || checkingAwareness}>
                    <CheckIcon size={16} />
                    {saving
                      ? 'Saving…'
                      : checkingAwareness
                        ? 'Checking…'
                        : 'Record transaction'}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={saving}
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </section>
        ) : null}

        <section className="card" aria-labelledby="filters-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="filters-title">
                Filter and search
              </h2>
              <p className="card-subtitle">
                Narrow history by account, direction, source or date range.
              </p>
            </div>
          </div>

          <form className="filter-grid" onSubmit={applyFilters}>
            <div className="field">
              <label className="field-label" htmlFor="filter-account">
                Account
              </label>
              <select
                id="filter-account"
                className="select"
                value={draftFilters.account_id}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    account_id: event.target.value,
                  }))
                }
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option value={account.id} key={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="filter-type">
                Direction
              </label>
              <select
                id="filter-type"
                className="select"
                value={draftFilters.transaction_type}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    transaction_type: event.target.value,
                  }))
                }
              >
                <option value="">Income and expenses</option>
                <option value="income">Income only</option>
                <option value="expense">Expenses only</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="filter-source">
                Source
              </label>
              <select
                id="filter-source"
                className="select"
                value={draftFilters.source}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    source: event.target.value,
                  }))
                }
              >
                <option value="">All sources</option>
                <option value="provider">Bank synced</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <Input
              label="Search"
              id="filter-search"
              value={draftFilters.search}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Description or merchant"
            />

            <Input
              label="From"
              id="filter-from"
              type="date"
              value={draftFilters.from_date}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  from_date: event.target.value,
                }))
              }
            />

            <Input
              label="To"
              id="filter-to"
              type="date"
              value={draftFilters.to_date}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  to_date: event.target.value,
                }))
              }
            />

            <div className="filter-actions">
              <Button type="submit" size="sm">
                Apply filters
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearFilters}
              >
                Clear
              </Button>
            </div>
          </form>
        </section>

        <section aria-labelledby="history-title">
          <div className="section-heading">
            <h2 id="history-title">History</h2>
            <p>
              {total === 0
                ? 'No transactions match these filters.'
                : `Showing ${from}–${to} of ${total} transaction${
                    total === 1 ? '' : 's'
                  }.`}
            </p>
          </div>

          {loading ? (
            <div className="page-loader">Loading transactions…</div>
          ) : items.length === 0 ? (
            <div className="card empty-finance">
              <span className="empty-art">
                <WalletIcon size={30} />
              </span>
              <h3>No transactions to show</h3>
              <p>
                Connect an account to sync activity, or record a manual
                transaction to start your history.
              </p>
            </div>
          ) : (
            <div className="card card-flush">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Description</th>
                      <th scope="col">Account</th>
                      <th scope="col">Category</th>
                      <th scope="col" className="align-right">
                        Amount
                      </th>
                      <th scope="col">Source</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        fallbackAccountName={
                          accountNames.get(transaction.account_id) ?? '—'
                        }
                        onEdit={() => startEditing(transaction)}
                        onDelete={() => void handleDelete(transaction)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pagination">
            <Button
              size="sm"
              variant="secondary"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <span className="muted-note">
              Page {Math.floor(offset / PAGE_SIZE) + 1}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={to >= total || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </section>

        {editing ? (
          <section className="card" aria-labelledby="edit-transaction-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="edit-transaction-title">
                  Edit “{editing.description}”
                </h2>
                <p className="card-subtitle">
                  Categories and notes can be changed for synced transactions.
                  The amount and date are provider-owned.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(null)}
              >
                Close
              </Button>
            </div>

            <div className="form-stack">
              <div className="field">
                <label className="field-label" htmlFor="edit-category">
                  Category
                </label>
                <select
                  id="edit-category"
                  className="select"
                  value={editCategory}
                  onChange={(event) => setEditCategory(event.target.value)}
                >
                  <option value="">Uncategorised</option>
                  {categories.map((category) => (
                    <option value={category.id} key={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Merchant"
                id="edit-merchant"
                value={editMerchant}
                onChange={(event) => setEditMerchant(event.target.value)}
              />
              <Input
                label="Notes"
                id="edit-notes"
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
              />

              <div className="form-actions">
                <Button
                  loading={editSaving}
                  onClick={() => void saveEditing()}
                >
                  Save changes
                </Button>
                <Button
                  variant="ghost"
                  disabled={editSaving}
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <div className="settings-note">
          <InfoIcon size={15} />
          <span>
            UniFlow stores only transaction details returned under consent.
            Bank passwords, UPI PINs, OTPs and CVVs are never requested or
            stored.
          </span>
        </div>
      </div>
    </>
  )
}

function TransactionRow({
  transaction,
  fallbackAccountName,
  onEdit,
  onDelete,
}: {
  transaction: Transaction
  fallbackAccountName: string
  onEdit: () => void
  onDelete: () => void
}) {
  const negative = Number(transaction.amount) < 0
  return (
    <tr>
      <td className="nowrap">{formatShortDate(transaction.occurred_on)}</td>
      <td>
        <span className="cell-primary">{transaction.description}</span>
        {transaction.merchant ? (
          <span className="cell-sub">{transaction.merchant}</span>
        ) : null}
        {transaction.notes ? (
          <span className="cell-sub">{transaction.notes}</span>
        ) : null}
      </td>
      <td>
        {transaction.account?.name ?? fallbackAccountName}
        {transaction.is_pending ? (
          <span className="cell-sub">Pending</span>
        ) : null}
      </td>
      <td>
        {transaction.category ? (
          <span className="category-chip">
            {transaction.category.name}
          </span>
        ) : (
          <span className="text-muted">Uncategorised</span>
        )}
      </td>
      <td
        className={
          negative
            ? 'align-right money money-negative'
            : 'align-right money money-positive'
        }
      >
        {formatSignedMoney(transaction.amount, transaction.currency)}
      </td>
      <td>
        <StatusBadge
          status={transaction.source}
          label={transaction.source === 'provider' ? 'Synced' : 'Manual'}
        />
      </td>
      <td>
        <div className="row-actions">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
          {transaction.source === 'manual' ? (
            <Button size="sm" variant="ghost" onClick={onDelete}>
              Delete
            </Button>
          ) : (
            <span
              className="muted-note nowrap"
              title="Provider-synced transactions cannot be deleted"
            >
              {formatMoney(transaction.amount, transaction.currency)}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}
