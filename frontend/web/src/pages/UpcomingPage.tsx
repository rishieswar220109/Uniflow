import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  CalendarIcon,
  ClockIcon,
  InfoIcon,
  LandmarkIcon,
  SparklesIcon,
} from '../components/icons'
import { MockBadge, StatusBadge } from '../components/finance/StatusBadge'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type {
  BankConnection,
  RecurringSuggestion,
  Summary,
} from '../services/types'
import { extractApiError } from '../utils/errors'
import {
  describeDueDate,
  formatDateTime,
  formatMoney,
  formatShortDate,
} from '../utils/format'

const WINDOWS = [7, 30, 60, 90]

export function UpcomingPage() {
  useDocumentTitle('Upcoming payments')

  const [days, setDays] = useState(30)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [suggestions, setSuggestions] = useState<RecurringSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState('')

  const load = useCallback(async () => {
    const [summaryData, connectionData, suggestionData] = await Promise.all([
      financeApi.getSummary(days),
      financeApi.getConnections(),
      financeApi.getRecurringSuggestions(),
    ])
    setSummary(summaryData)
    setConnections(connectionData)
    setSuggestions(suggestionData)
  }, [days])

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
              'Unable to load your upcoming payments.',
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

  const grouped = useMemo(() => {
    const map = new Map<string, Summary['upcoming_payments']>()
    for (const item of summary?.upcoming_payments ?? []) {
      const existing = map.get(item.due_date) ?? []
      existing.push(item)
      map.set(item.due_date, existing)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [summary])

  async function handleSync(connection: BankConnection) {
    setSyncingId(connection.id)
    setError('')
    setSyncMessage('')
    try {
      const job = await financeApi.syncConnection(connection.id)
      setSyncMessage(
        `Synchronised ${job.accounts_synced} account(s): ` +
          `${job.transactions_created} new, ` +
          `${job.transactions_skipped} already known.`,
      )
      await load()
    } catch (syncError) {
      setError(extractApiError(syncError, 'Unable to synchronise now.'))
    } finally {
      setSyncingId(null)
    }
  }

  if (loading && !summary) {
    return <div className="page-loader">Loading your payment calendar…</div>
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Payment calendar</span>
          <h1 className="page-title">Upcoming payments</h1>
          <p className="page-subtitle">
            Bills and subscriptions due in the selected window, plus recurring
            candidates found in transaction history. Suggestions never create
            bills automatically.
          </p>
        </div>
        <div className="inline">
          {summary?.is_mock_data ? <MockBadge /> : null}
          <Link className="btn btn-secondary btn-sm" to="/bills">
            Manage bills
          </Link>
        </div>
      </header>

      <div className="stack-lg">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {syncMessage ? <Alert variant="success">{syncMessage}</Alert> : null}

        <section className="card" aria-labelledby="window-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="window-title">
                Calendar window
              </h2>
              <p className="card-subtitle">
                Overdue unpaid bills stay visible so nothing is silently missed.
              </p>
            </div>
            <div className="chip-row" role="group" aria-label="Calendar window">
              {WINDOWS.map((window) => (
                <button
                  type="button"
                  key={window}
                  className={days === window ? 'chip chip-active' : 'chip'}
                  onClick={() => setDays(window)}
                >
                  {window} days
                </button>
              ))}
            </div>
          </div>

          <div className="stat-grid stat-grid-compact">
            <div className="stat-card">
              <span className="stat-label">Due in window</span>
              <strong className="stat-value">
                {formatMoney(
                  summary?.upcoming_total ?? '0.00',
                  summary?.currency ?? 'INR',
                )}
              </strong>
              <span className="stat-hint">
                {summary?.upcoming_bills_count ?? 0} bills ·{' '}
                {summary?.upcoming_subscriptions_count ?? 0} subscriptions
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Active accounts</span>
              <strong className="stat-value">
                {summary?.accounts_count ?? 0}
              </strong>
              <span className="stat-hint">
                {summary?.connected_accounts_count ?? 0} connection(s)
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Last synchronised</span>
              <strong className="stat-value stat-value-sm">
                {formatDateTime(summary?.last_synced_at)}
              </strong>
              <span className="stat-hint">
                {summary?.is_mock_data
                  ? 'Mock data is labelled throughout'
                  : 'Consent-based data only'}
              </span>
            </div>
          </div>
        </section>

        <section aria-labelledby="calendar-title">
          <div className="section-heading">
            <h2 id="calendar-title">Due soon</h2>
            <p>
              {grouped.length === 0
                ? 'Nothing is due in this window.'
                : `${summary?.upcoming_payments.length ?? 0} payment(s) in the ` +
                  `next ${days} days.`}
            </p>
          </div>

          {grouped.length === 0 ? (
            <div className="card empty-finance">
              <span className="empty-art">
                <CalendarIcon size={30} />
              </span>
              <h3>No upcoming payments</h3>
              <p>
                Add a bill or subscription, or widen the calendar window. If you
                have not connected an account yet, manual entries are still
                included here.
              </p>
              <div className="inline">
                <Link className="btn btn-primary btn-sm" to="/bills">
                  Add a bill
                </Link>
                <Link className="btn btn-secondary btn-sm" to="/subscriptions">
                  Add a subscription
                </Link>
              </div>
            </div>
          ) : (
            <div className="stack">
              {grouped.map(([dueDate, items]) => (
                <article className="card calendar-group" key={dueDate}>
                  <div className="calendar-date">
                    <span className="calendar-day">
                      {formatShortDate(dueDate)}
                    </span>
                    <span className="calendar-relative">
                      {describeDueDate(dueDate)}
                    </span>
                  </div>
                  <ul className="calendar-list">
                    {items.map((item) => (
                      <li key={`${item.kind}-${item.id}`}>
                        <span className="calendar-kind">
                          {item.kind === 'bill' ? (
                            <CalendarIcon size={15} />
                          ) : (
                            <SparklesIcon size={15} />
                          )}
                        </span>
                        <span className="calendar-copy">
                          <span className="cell-primary">{item.name}</span>
                          <span className="cell-sub">
                            {item.kind === 'bill' ? 'Bill' : 'Subscription'}
                            {item.is_recurring ? ' · recurring' : ''}
                            {item.autopay ? ' · autopay label' : ''}
                          </span>
                        </span>
                        <StatusBadge status={item.status} />
                        <strong className="money">
                          {formatMoney(item.amount, item.currency)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="sync-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="sync-title">
                Synchronisation status
              </h2>
              <p className="card-subtitle">
                Consent status and the last successful retrieval for each
                connection.
              </p>
            </div>
            <Link className="btn btn-secondary btn-sm" to="/accounts">
              Manage connections
            </Link>
          </div>

          {connections.length === 0 ? (
            <div className="empty-inline">
              <span className="empty-art empty-art-sm">
                <LandmarkIcon size={22} />
              </span>
              <div>
                <strong>No bank connections</strong>
                <p className="muted-note">
                  Connect a provider to sync balances and transactions. Bills
                  and subscriptions work without a connection.
                </p>
              </div>
              <Link className="btn btn-primary btn-sm" to="/accounts">
                Connect account
              </Link>
            </div>
          ) : (
            <div className="stack-sm">
              {connections.map((connection) => (
                <div className="sync-row" key={connection.id}>
                  <div>
                    <div className="inline">
                      <strong>{connection.institution_name}</strong>
                      <StatusBadge status={connection.status} />
                      {connection.is_mock ? <MockBadge /> : null}
                    </div>
                    <span className="cell-sub">
                      Last synced {formatDateTime(connection.last_synced_at)}
                      {connection.last_error
                        ? ` · ${connection.last_error}`
                        : ''}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={syncingId === connection.id}
                    disabled={syncingId !== null || connection.status !== 'active'}
                    onClick={() => void handleSync(connection)}
                  >
                    Sync now
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="recurring-title">
          <div className="section-heading">
            <h2 id="recurring-title">Recurring candidates</h2>
            <p>
              Deterministic suggestions from your synced transaction history.
              Review them before creating a subscription.
            </p>
          </div>

          {suggestions.length === 0 ? (
            <div className="card empty-finance">
              <span className="empty-art">
                <ClockIcon size={30} />
              </span>
              <h3>No recurring patterns yet</h3>
              <p>
                UniFlow needs at least two similar transactions at a stable
                interval. Connect an account or add more history to see
                candidates.
              </p>
            </div>
          ) : (
            <div className="card card-flush">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Merchant</th>
                      <th scope="col">Cadence</th>
                      <th scope="col" className="align-right">
                        Average
                      </th>
                      <th scope="col">Last seen</th>
                      <th scope="col">Next expected</th>
                      <th scope="col">Confidence</th>
                      <th scope="col">Linked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((suggestion) => (
                      <tr key={`${suggestion.merchant}-${suggestion.cadence}`}>
                        <td>
                          <span className="cell-primary">
                            {suggestion.merchant}
                          </span>
                          <span className="cell-sub">
                            {suggestion.occurrences} occurrence(s)
                          </span>
                        </td>
                        <td>{suggestion.cadence}</td>
                        <td className="align-right money">
                          {formatMoney(
                            suggestion.average_amount,
                            suggestion.currency,
                          )}
                        </td>
                        <td>{formatShortDate(suggestion.last_seen_on)}</td>
                        <td>{formatShortDate(suggestion.next_expected_on)}</td>
                        <td>
                          <span className="confidence">
                            <span className="confidence-track">
                              <span
                                className="confidence-bar"
                                style={{
                                  width: `${Math.round(
                                    suggestion.confidence * 100,
                                  )}%`,
                                }}
                              />
                            </span>
                            <span className="muted-note">
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </span>
                        </td>
                        <td>
                          {suggestion.matched_subscription_id ? (
                            <StatusBadge
                              status="active"
                              label="Subscription"
                            />
                          ) : suggestion.matched_bill_id ? (
                            <StatusBadge status="upcoming" label="Bill" />
                          ) : (
                            <span className="muted-note">Not linked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="settings-note" style={{ marginTop: 14 }}>
            <InfoIcon size={15} />
            <span>
              Suggestions are generated with fixed rules from stored
              transactions. They are not predictions and do not create or pay
              anything.
            </span>
          </div>
        </section>
      </div>
    </>
  )
}
