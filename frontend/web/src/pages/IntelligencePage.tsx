import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  AlertCircleIcon,
  ClockIcon,
  SparklesIcon,
} from '../components/icons'
import { StatusBadge } from '../components/finance/StatusBadge'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type {
  CashFlowForecast,
  FinancialInsight,
  FinancialRisk,
  MonthlySummary,
  SpendingTrend,
} from '../services/types'
import { extractApiError } from '../utils/errors'
import {
  formatMoney,
  formatShortDate,
} from '../utils/format'

export function IntelligencePage() {
  useDocumentTitle('Financial intelligence')

  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [trends, setTrends] = useState<SpendingTrend | null>(null)
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null)
  const [risks, setRisks] = useState<FinancialRisk[]>([])
  const [insights, setInsights] = useState<FinancialInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    const today = new Date()
    const [summaryData, trendsData, forecastData, risksData] =
      await Promise.all([
        financeApi.getMonthlySummary({
          year: today.getFullYear(),
          month: today.getMonth() + 1,
        }),
        financeApi.getSpendingTrends({ lookback_days: 90 }),
        financeApi.getCashFlowForecast({ days: 30 }),
        financeApi.detectFinancialRisks(),
      ])
    setSummary(summaryData)
    setTrends(trendsData)
    setForecast(forecastData)
    setRisks(risksData)
  }, [])

  const loadInsights = useCallback(async () => {
    const insightData = await financeApi.listInsights({
      is_dismissed: false,
    })
    setInsights(insightData.items)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        await load()
        const insightData = await financeApi.listInsights({
          is_dismissed: false,
        })
        if (!cancelled) setInsights(insightData.items)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            extractApiError(
              loadError,
              'Unable to load your financial intelligence.',
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

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    setError('')
    setSuccess('')
    try {
      await financeApi.generateInsights()
      await loadInsights()
      setSuccess('Insights refreshed from your stored records.')
    } catch (refreshError) {
      setError(
        extractApiError(refreshError, 'Unable to generate insights right now.'),
      )
    } finally {
      setRefreshing(false)
    }
  }

  async function handleDismiss(insightId: string) {
    setError('')
    setSuccess('')
    try {
      await financeApi.dismissInsight(insightId)
      setInsights((current) => current.filter((item) => item.id !== insightId))
    } catch (dismissError) {
      setError(
        extractApiError(dismissError, 'Unable to dismiss this insight.'),
      )
    }
  }

  if (loading) return <div className="page-loader">Loading intelligence…</div>

  const criticalRisks = risks.filter((r) => r.severity === 'critical')
  const warningRisks = risks.filter((r) => r.severity === 'warning')

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Financial intelligence</span>
          <h1 className="page-title">UniFlow insights</h1>
          <p className="page-subtitle">
            Deterministic analysis of your stored transactions, bills, and
            subscriptions. All figures are computed from verified records —
            never estimated by an AI model.
          </p>
        </div>
        <div className="inline">
          <Link className="btn btn-secondary btn-sm" to="/spending-preferences">
            Spending preferences
          </Link>
          <Button loading={refreshing} onClick={() => void handleRefresh()}>
            <SparklesIcon size={16} />
            {refreshing ? 'Refreshing…' : 'Refresh insights'}
          </Button>
        </div>
      </header>

      <div className="stack-lg">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        <section className="card" aria-labelledby="cash-flow-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="cash-flow-title">
                Cash-flow forecast
              </h2>
              <p className="card-subtitle">
                Projected balance over the next 30 days based on available
                balance, upcoming obligations, and recent income.
              </p>
            </div>
          </div>

          <div className="stat-grid stat-grid-compact">
            <div className="stat-card">
              <span className="stat-label">Available balance</span>
              <strong className="stat-value">
                {formatMoney(
                  forecast?.available_balance ?? '0.00',
                  forecast?.currency ?? 'INR',
                )}
              </strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Expected income</span>
              <strong className="stat-value">
                {formatMoney(
                  forecast?.expected_income ?? '0.00',
                  forecast?.currency ?? 'INR',
                )}
              </strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Expected expenses</span>
              <strong className="stat-value">
                {formatMoney(
                  forecast?.expected_expenses ?? '0.00',
                  forecast?.currency ?? 'INR',
                )}
              </strong>
            </div>
            <div className="stat-card">
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
                  forecast?.currency ?? 'INR',
                )}
              </strong>
            </div>
          </div>

          {forecast?.upcoming_obligations && forecast.upcoming_obligations.length > 0 ? (
            <div className="stack-sm" style={{ marginTop: 14 }}>
              <span className="subsection-label">Upcoming obligations</span>
              <ul className="data-list">
                {forecast.upcoming_obligations.slice(0, 8).map((obligation) => (
                  <li key={obligation.id} className="data-list-item">
                    <span className="cell-primary">{obligation.name}</span>
                    <span className="cell-sub">
                      {formatShortDate(obligation.due_date)} · {obligation.kind}
                    </span>
                    <strong className="align-right money">
                      {formatMoney(obligation.amount, obligation.currency)}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="settings-note" style={{ marginTop: 14 }}>
            <span className="muted-note">
              {forecast?.assumptions}
            </span>
          </div>
        </section>

        {summary ? (
          <section className="card" aria-labelledby="monthly-summary-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="monthly-summary-title">
                  This month
                </h2>
                <p className="card-subtitle">
                  Income, expenses, and category breakdown for{' '}
                  {summary.year}-{String(summary.month).padStart(2, '0')}.
                </p>
              </div>
            </div>

            <div className="stat-grid stat-grid-compact">
              <div className="stat-card">
                <span className="stat-label">Income</span>
                <strong className="stat-value stat-value-positive">
                  {formatMoney(summary.income, summary.currency)}
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Expenses</span>
                <strong className="stat-value stat-value-negative">
                  {formatMoney(summary.expenses, summary.currency)}
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Net</span>
                <strong className="stat-value">
                  {Number(summary.net) >= 0 ? '+' : ''}
                  {formatMoney(summary.net, summary.currency)}
                </strong>
              </div>
            </div>

            <div className="stack-sm" style={{ marginTop: 14 }}>
              <span className="subsection-label">Category expenses</span>
              <ul className="data-list">
                {Object.entries(summary.category_expenses)
                  .sort(([, a], [, b]) => Number(b) - Number(a))
                  .slice(0, 6)
                  .map(([category, amount]) => (
                    <li key={category} className="data-list-item">
                      <span className="cell-primary">{category}</span>
                      <strong className="align-right money">
                        {formatMoney(amount, summary.currency)}
                      </strong>
                    </li>
                  ))}
              </ul>
            </div>

            {Object.keys(summary.currency_breakdown).length > 1 ? (
              <div className="stack-sm" style={{ marginTop: 14 }}>
                <span className="subsection-label">
                  By currency (not converted)
                </span>
                <ul className="data-list">
                  {Object.entries(summary.currency_breakdown).map(
                    ([code, totals]) => (
                      <li key={code} className="data-list-item">
                        <span className="cell-primary">{code}</span>
                        <span className="cell-sub">
                          Income {formatMoney(totals.income, code)} · Expenses{' '}
                          {formatMoney(totals.expenses, code)} · {totals.count}{' '}
                          transaction(s)
                        </span>
                      </li>
                    ),
                  )}
                </ul>
                <span className="muted-note">
                  Totals above are only for {summary.currency}. Amounts in other
                  currencies are listed separately rather than summed.
                </span>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="card" aria-labelledby="risks-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="risks-title">
                Risk detection
              </h2>
              <p className="card-subtitle">
                Detected financial risks from your stored records.
              </p>
            </div>
          </div>

          {risks.length === 0 ? (
            <div className="empty-inline">
              <span className="empty-art empty-art-sm">
                <AlertCircleIcon size={22} />
              </span>
              <div>
                <strong>No risks detected</strong>
                <p className="muted-note">
                  Your financial position looks stable based on current records.
                </p>
              </div>
            </div>
          ) : (
            <div className="stack-sm">
              {criticalRisks.length > 0 ? (
                <>
                  <span className="subsection-label" style={{ color: '#dc2626' }}>
                    Critical
                  </span>
                  <ul className="data-list">
                    {criticalRisks.map((risk) => (
                      <li key={risk.title} className="data-list-item">
                        <span className="cell-primary">{risk.title}</span>
                        <span className="cell-sub">{risk.description}</span>
                        {risk.amount ? (
                          <strong className="align-right money">
                            {formatMoney(risk.amount, risk.currency ?? 'INR')}
                          </strong>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {warningRisks.length > 0 ? (
                <>
                  <span className="subsection-label" style={{ color: '#ca8a04' }}>
                    Warnings
                  </span>
                  <ul className="data-list">
                    {warningRisks.map((risk) => (
                      <li key={risk.title} className="data-list-item">
                        <span className="cell-primary">{risk.title}</span>
                        <span className="cell-sub">{risk.description}</span>
                        {risk.amount ? (
                          <strong className="align-right money">
                            {formatMoney(risk.amount, risk.currency ?? 'INR')}
                          </strong>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {risks.length > criticalRisks.length + warningRisks.length ? (
                <div className="stack-sm" style={{ marginTop: 8 }}>
                  <span className="subsection-label">Info</span>
                  <ul className="data-list">
                    {risks
                      .filter((r) => r.severity === 'info')
                      .map((risk) => (
                        <li key={risk.title} className="data-list-item">
                          <span className="cell-primary">{risk.title}</span>
                          <span className="cell-sub">{risk.description}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {trends ? (
          <section className="card" aria-labelledby="trends-title">
            <div className="card-header">
              <div>
                <h2 className="card-title" id="trends-title">
                  Spending trends
                </h2>
                <p className="card-subtitle">
                  Weekly expense totals over the last{' '}
                  {trends.lookback_days} days.
                </p>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-label">Trend</span>
              <strong className="stat-value">
                {trends.trend.charAt(0).toUpperCase() + trends.trend.slice(1)}
              </strong>
              <span className="stat-hint">
                {Object.keys(trends.weekly_spending).length} week(s) of data
              </span>
            </div>
          </section>
        ) : null}

        <section className="card" aria-labelledby="insights-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="insights-title">
                Insights
              </h2>
              <p className="card-subtitle">
                Generated insights you can dismiss when no longer relevant.
              </p>
            </div>
          </div>

          {insights.length === 0 ? (
            <div className="empty-inline">
              <span className="empty-art empty-art-sm">
                <ClockIcon size={22} />
              </span>
              <div>
                <strong>No insights yet</strong>
                <p className="muted-note">
                  Generate insights to see detected risks and observations.
                </p>
              </div>
            </div>
          ) : (
            <div className="stack-sm">
              {insights.map((insight) => (
                <article
                  className="card card-flush insight-card"
                  key={insight.id}
                >
                  <div className="insight-head">
                    <span className="insight-icon">
                      <AlertCircleIcon size={16} />
                    </span>
                    <div className="insight-copy">
                      <div className="inline">
                        <h3 className="insight-title">{insight.title}</h3>
                        <StatusBadge
                          status={insight.severity}
                          label={insight.severity.charAt(0).toUpperCase() + insight.severity.slice(1)}
                        />
                      </div>
                      <p className="insight-description">
                        {insight.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDismiss(insight.id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
