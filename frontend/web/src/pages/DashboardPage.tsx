import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  AlertCircleIcon,
  ArrowRightIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  InfoIcon,
  LandmarkIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendIcon,
  WalletIcon,
} from '../components/icons'
import { MockBadge, StatusBadge } from '../components/finance/StatusBadge'
import { Alert } from '../components/ui/Alert'
import { useAuth } from '../features/auth/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type {
  CashFlowForecast,
  FinancialInsight,
  Summary,
} from '../services/types'
import { extractApiError } from '../utils/errors'
import {
  describeDueDate,
  firstName,
  formatDateTime,
  formatMoney,
  formatShortDate,
  formatSignedMoney,
} from '../utils/format'

export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null)
  const [insights, setInsights] = useState<FinancialInsight[]>([])
  const [insightError, setInsightError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [today] = useState(() =>
    new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date()),
  )

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const data = await financeApi.getSummary(30)
        if (!cancelled) setSummary(data)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            extractApiError(
              loadError,
              'Unable to load your financial overview.',
            ),
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }

      // Phase 3 additions are supplementary: a failure here must not hide the
      // Phase 2 overview that has already loaded.
      try {
        const forecastData = await financeApi.getCashFlowForecast({ days: 30 })
        if (!cancelled) setForecast(forecastData)
      } catch {
        if (!cancelled) setForecast(null)
      }

      try {
        const insightPage = await financeApi.listInsights({
          is_dismissed: false,
          limit: 5,
        })
        if (!cancelled) {
          setInsights(insightPage.items)
          setInsightError('')
        }
      } catch (insightLoadError) {
        if (!cancelled) {
          setInsightError(
            extractApiError(insightLoadError, 'Insights are unavailable.'),
          )
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (!user) return null

  const currency = summary?.currency ?? user.preferences.currency
  const hasAccounts = (summary?.accounts_count ?? 0) > 0
  const hasObligations =
    (summary?.upcoming_payments.length ?? 0) > 0 ||
    (summary?.recent_transactions.length ?? 0) > 0
  const upcoming = (summary?.upcoming_payments ?? []).slice(0, 6)
  const recent = summary?.recent_transactions ?? []

  // Only present a projection when the forecast is backed by real inputs.
  const hasForecast = Boolean(forecast) &&
    (Number(forecast?.expected_income ?? 0) > 0 ||
      Number(forecast?.expected_expenses ?? 0) > 0 ||
      Number(forecast?.available_balance ?? 0) > 0)

  const severityRank: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  }
  const topInsight = [...insights].sort(
    (a, b) =>
      (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3),
  )[0]

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">{today}</span>
          <h1 className="page-title">Welcome back, {firstName(user.full_name)}</h1>
          <p className="page-subtitle">
            Your financial workspace: balances, activity and what is due next.
            UniFlow tracks and reminds — you stay in control of every payment.
          </p>
        </div>
        <div className="inline">
          {summary?.is_mock_data ? <MockBadge /> : null}
          {hasAccounts ? (
            <span className="badge badge-success badge-plain">
              <ShieldCheckIcon size={13} /> Connected
            </span>
          ) : (
            <span className="badge badge-neutral badge-plain">
              No connection yet
            </span>
          )}
        </div>
      </header>

      <div className="stack-lg">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {!loading && !hasAccounts ? (
          <section className="card connect-banner">
            <div className="inline">
              <span className="feature-icon">
                <LandmarkIcon size={19} />
              </span>
              <div>
                <h2 className="card-title">Connect a financial account</h2>
                <p className="card-subtitle">
                  Consent-based connections bring balances and transactions into
                  UniFlow. No banking passwords, PINs, OTPs or CVVs are ever
                  requested. You can also track bills manually.
                </p>
              </div>
            </div>
            <Link className="btn btn-primary btn-sm" to="/accounts">
              Connect an account
            </Link>
          </section>
        ) : null}

        <section className="stat-grid" aria-label="Financial summary">
          <div className="stat-card">
            <span className="stat-icon">
              <WalletIcon size={18} />
            </span>
            <span className="stat-label">Total balance</span>
            <strong className="stat-value">
              {loading
                ? '…'
                : formatMoney(summary?.total_balance ?? '0.00', currency)}
            </strong>
            <span className="stat-hint">
              {summary?.accounts_count ?? 0} active account(s)
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              <LandmarkIcon size={18} />
            </span>
            <span className="stat-label">Available</span>
            <strong className="stat-value">
              {loading
                ? '…'
                : formatMoney(summary?.total_available ?? '0.00', currency)}
            </strong>
            <span className="stat-hint">After pending holds</span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              <TrendIcon size={18} />
            </span>
            <span className="stat-label">Spent this month</span>
            <strong className="stat-value">
              {loading
                ? '…'
                : formatMoney(summary?.month_expenses ?? '0.00', currency)}
            </strong>
            <span className="stat-hint">
              Income{' '}
              {formatMoney(summary?.month_income ?? '0.00', currency)}
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">
              <CalendarIcon size={18} />
            </span>
            <span className="stat-label">Upcoming · 30 days</span>
            <strong className="stat-value">
              {loading
                ? '…'
                : formatMoney(summary?.upcoming_total ?? '0.00', currency)}
            </strong>
            <span className="stat-hint">
              {summary?.upcoming_bills_count ?? 0} bills ·{' '}
              {summary?.upcoming_subscriptions_count ?? 0} subscriptions
            </span>
          </div>

          {hasForecast ? (
            <div className="stat-card">
              <span className="stat-icon">
                <TrendIcon size={18} />
              </span>
              <span className="stat-label">Projected balance</span>
              <strong
                className={
                  Number(forecast?.projected_balance ?? 0) < 0
                    ? 'stat-value stat-value-negative'
                    : 'stat-value'
                }
              >
                {formatMoney(
                  forecast?.projected_balance ?? '0.00',
                  forecast?.currency ?? currency,
                )}
              </strong>
              <span className="stat-hint">
                Predicted in {forecast?.days ?? 30} days from recorded income and
                obligations
              </span>
            </div>
          ) : null}
        </section>

        {!loading && (summary?.currency_breakdown?.length ?? 0) > 1 ? (
          <div className="settings-note">
            <InfoIcon size={15} />
            <span>
              Totals combine only {currency}.{' '}
              {summary?.currency_breakdown
                ?.filter((row) => row.currency !== currency)
                .map(
                  (row) =>
                    `${row.currency} ${formatMoney(
                      row.total_balance,
                      row.currency,
                    )}`,
                )
                .join(' · ')}
              {' '}are listed separately and never converted at an invented
              exchange rate.
            </span>
          </div>
        ) : null}

        <div className="dashboard-grid">
          <div className="dashboard-main">
            <section className="card" aria-labelledby="due-title">
              <div className="card-header">
                <div>
                  <h2 className="card-title" id="due-title">
                    Due soon
                  </h2>
                  <p className="card-subtitle">
                    Bills and subscriptions in the next 30 days.
                  </p>
                </div>
                <Link className="inline-link" to="/upcoming">
                  Calendar <ChevronRightIcon size={14} />
                </Link>
              </div>

              {loading ? (
                <div className="page-loader">Loading upcoming payments…</div>
              ) : upcoming.length === 0 ? (
                <div className="empty-inline">
                  <span className="empty-art empty-art-sm">
                    <CalendarIcon size={22} />
                  </span>
                  <div>
                    <strong>Nothing due soon</strong>
                    <p className="muted-note">
                      Add a bill or subscription to build your payment calendar.
                    </p>
                  </div>
                  <Link className="btn btn-secondary btn-sm" to="/bills">
                    Add a bill
                  </Link>
                </div>
              ) : (
                <ul className="due-list">
                  {upcoming.map((item) => (
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
                          {formatShortDate(item.due_date)} ·{' '}
                          {describeDueDate(item.due_date)}
                        </span>
                      </span>
                      <StatusBadge status={item.status} />
                      <strong className="money">
                        {formatMoney(item.amount, item.currency)}
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card" aria-labelledby="recent-title">
              <div className="card-header">
                <div>
                  <h2 className="card-title" id="recent-title">
                    Recent activity
                  </h2>
                  <p className="card-subtitle">
                    The latest stored transactions across your accounts.
                  </p>
                </div>
                <Link className="inline-link" to="/transactions">
                  All transactions <ChevronRightIcon size={14} />
                </Link>
              </div>

              {loading ? (
                <div className="page-loader">Loading activity…</div>
              ) : recent.length === 0 ? (
                <div className="empty-inline">
                  <span className="empty-art empty-art-sm">
                    <WalletIcon size={22} />
                  </span>
                  <div>
                    <strong>No activity yet</strong>
                    <p className="muted-note">
                      Connect an account or record a manual transaction to see
                      history here.
                    </p>
                  </div>
                  <Link
                    className="btn btn-secondary btn-sm"
                    to="/transactions"
                  >
                    Add transaction
                  </Link>
                </div>
              ) : (
                <ul className="activity-list">
                  {recent.map((transaction) => {
                    const negative = Number(transaction.amount) < 0
                    return (
                      <li key={transaction.id}>
                        <span className="activity-copy">
                          <span className="cell-primary">
                            {transaction.description}
                          </span>
                          <span className="cell-sub">
                            {formatShortDate(transaction.occurred_on)} ·{' '}
                            {transaction.account?.name ?? 'Account'}
                            {transaction.category
                              ? ` · ${transaction.category.name}`
                              : ''}
                          </span>
                        </span>
                        <strong
                          className={
                            negative
                              ? 'money money-negative'
                              : 'money money-positive'
                          }
                        >
                          {formatSignedMoney(
                            transaction.amount,
                            transaction.currency,
                          )}
                        </strong>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          <aside className="dashboard-side" aria-label="UniFlow status">
            <section className="card" aria-labelledby="guardian-title">
              <div className="card-header">
                <div>
                  <h2 className="card-title" id="guardian-title">
                    UniFlow
                  </h2>
                  <p className="card-subtitle">Tracking, not deciding</p>
                </div>
                <SparklesIcon size={19} className="text-muted" />
              </div>

              <div className="guardian-status">
                <span className="guardian-orb">
                  <SparklesIcon size={20} />
                </span>
                <span className="guardian-copy">
                  <strong>
                    {hasAccounts ? 'Tracking your money' : 'Standing by'}
                  </strong>
                  <span>
                    {hasAccounts
                      ? 'Balances, bills and subscriptions are up to date.'
                      : 'Connect an account or add obligations manually.'}
                  </span>
                </span>
              </div>

              <ul className="detail-list" style={{ marginTop: 8 }}>
                <li className="detail-row">
                  <span className="detail-label">Forecasting &amp; insights</span>
                  <span className="detail-value text-muted">Active</span>
                </li>
                <li className="detail-row">
                  <span className="detail-label">Conversational answers</span>
                  <span className="detail-value text-muted">Phase 4</span>
                </li>
                <li className="detail-row">
                  <span className="detail-label">Approval-based actions</span>
                  <span className="detail-value text-muted">Phase 5</span>
                </li>
              </ul>
            </section>

            <section className="card" aria-labelledby="month-title">
              <div className="card-header">
                <div>
                  <h2 className="card-title" id="month-title">
                    This month
                  </h2>
                  <p className="card-subtitle">
                    Derived from stored transactions.
                  </p>
                </div>
              </div>

              <ul className="detail-list">
                <li className="detail-row">
                  <span className="detail-label">Income</span>
                  <span className="detail-value money money-positive">
                    {formatMoney(summary?.month_income ?? '0.00', currency)}
                  </span>
                </li>
                <li className="detail-row">
                  <span className="detail-label">Expenses</span>
                  <span className="detail-value money money-negative">
                    {formatMoney(summary?.month_expenses ?? '0.00', currency)}
                  </span>
                </li>
                <li className="detail-row">
                  <span className="detail-label">Net</span>
                  <span className="detail-value money">
                    {formatSignedMoney(
                      summary?.net_this_month ?? '0.00',
                      currency,
                    )}
                  </span>
                </li>
              </ul>

              <div className="inline" style={{ marginTop: 14 }}>
                <ClockIcon size={14} className="text-muted" />
                <span className="muted-note">
                  Last synced {formatDateTime(summary?.last_synced_at)}
                </span>
              </div>
            </section>

            <section className="card" aria-labelledby="insight-title">
              <div className="card-header">
                <div>
                  <h2 className="card-title" id="insight-title">
                    UniFlow insight
                  </h2>
                  <p className="card-subtitle">
                    The most important finding from your stored records.
                  </p>
                </div>
                <Link className="inline-link" to="/intelligence">
                  All insights <ChevronRightIcon size={14} />
                </Link>
              </div>

              {insightError ? (
                <p className="muted-note">{insightError}</p>
              ) : topInsight ? (
                <div className="insight-head">
                  <span className="insight-icon">
                    <AlertCircleIcon size={16} />
                  </span>
                  <div className="insight-copy">
                    <div className="inline">
                      <h3 className="insight-title">{topInsight.title}</h3>
                      <StatusBadge
                        status={topInsight.severity}
                        label={
                          topInsight.severity.charAt(0).toUpperCase() +
                          topInsight.severity.slice(1)
                        }
                      />
                    </div>
                    <p className="insight-description">
                      {topInsight.description}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="muted-note">
                  No insights yet. Generate insights to see detected risks and
                  observations.
                </p>
              )}
            </section>

            <section className="card card-muted" aria-labelledby="ask-guardian-title">
              <div className="inline" style={{ marginBottom: 10 }}>
                <SparklesIcon size={18} />
                <h2 className="card-title" id="ask-guardian-title">
                  Ask UniFlow
                </h2>
                <span className="badge badge-neutral">Phase 4</span>
              </div>
              <p className="muted-note" style={{ lineHeight: 1.65 }}>
                Ask questions about your money in plain language. This AI
                capability is planned for Phase 4 and is not available yet —
                nothing on this dashboard is generated by a language model.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled
                aria-disabled="true"
                title="Ask UniFlow arrives in Phase 4"
              >
                Ask UniFlow — coming in Phase 4
              </button>
            </section>

            <section className="card" aria-labelledby="shortcuts-title">
              <div className="card-header">
                <div>
                  <h2 className="card-title" id="shortcuts-title">
                    Quick links
                  </h2>
                  <p className="card-subtitle">Jump straight to a task.</p>
                </div>
              </div>

              <div className="next-steps">
                {!hasObligations ? (
                  <Link className="next-step" to="/bills">
                    Add your first bill
                    <ChevronRightIcon size={16} />
                  </Link>
                ) : null}
                <Link className="next-step" to="/transactions">
                  Review transactions
                  <ChevronRightIcon size={16} />
                </Link>
                <Link className="next-step" to="/subscriptions">
                  Manage subscriptions
                  <ChevronRightIcon size={16} />
                </Link>
                <Link className="next-step" to="/budgets">
                  Budgets and savings goals
                  <ChevronRightIcon size={16} />
                </Link>
                <Link className="next-step" to="/intelligence">
                  Cash-flow forecast and risks
                  <ChevronRightIcon size={16} />
                </Link>
                <Link className="next-step" to="/accounts">
                  Connections and balances
                  <ArrowRightIcon size={16} />
                </Link>
              </div>
            </section>

            <section
              className="card card-muted"
              aria-labelledby="protection-title"
            >
              <div className="inline" style={{ marginBottom: 10 }}>
                <ShieldCheckIcon size={18} />
                <h2 className="card-title" id="protection-title">
                  Protection active
                </h2>
              </div>
              <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>
                <li className="muted-note">
                  Consent-based financial data only
                </li>
                <li className="muted-note">
                  No passwords, PINs, OTPs or CVVs stored
                </li>
                <li className="muted-note">
                  Per-user isolation on every record
                </li>
                <li className="muted-note">
                  Mock data is labelled wherever it appears
                </li>
              </ul>
              <div className="inline" style={{ marginTop: 14 }}>
                <InfoIcon size={14} className="text-muted" />
                <span className="muted-note">
                  Payments are recorded only after your confirmation.
                </span>
              </div>
            </section>
          </aside>
        </div>

        {!loading && !hasObligations ? (
          <section className="card empty-finance">
            <span className="empty-art">
              <WalletIcon size={30} />
            </span>
            <h3>Your financial workspace is ready</h3>
            <p>
              Start by connecting an account for automatic balances and
              transactions, or add bills and subscriptions manually. UniFlow
              never invents financial data.
            </p>
            <div className="inline">
              <Link className="btn btn-primary btn-sm" to="/accounts">
                Connect account
              </Link>
              <Link className="btn btn-secondary btn-sm" to="/bills">
                Add a bill
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}
