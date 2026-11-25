import { useCallback, useEffect, useState } from 'react'

import { InfoIcon, WalletIcon } from '../components/icons'
import { StatusBadge } from '../components/finance/StatusBadge'
import { Alert } from '../components/ui/Alert'
import { Input } from '../components/ui/Input'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { financeApi } from '../services/financeApi'
import type { FinancialReport } from '../services/types'
import { extractApiError } from '../utils/errors'
import { formatMoney } from '../utils/format'

function currentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function ReportsPage() {
  useDocumentTitle('Financial reports')

  const [monthValue, setMonthValue] = useState(currentMonthValue)
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (value: string) => {
    const [year, month] = value.split('-').map(Number)
    if (!year || !month) return
    const data = await financeApi.getFinancialReport({ year, month })
    setReport(data)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        await load(monthValue)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            extractApiError(loadError, 'Unable to load this financial report.'),
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
  }, [load, monthValue])

  const currency = report?.currency ?? 'INR'
  const otherCurrencies =
    report?.currency_breakdown
      ? Object.keys(report.currency_breakdown).filter((code) => code !== currency)
      : []

  return (
    <>
      <header className="page-header">
        <div className="page-header-copy">
          <span className="page-kicker">Financial reports</span>
          <h1 className="page-title">Monthly report</h1>
          <p className="page-subtitle">
            A deterministic summary of stored transactions, budgets and savings
            for one calendar month. Reports are computed by the backend from
            verified records — nothing is estimated by an AI model.
          </p>
        </div>
        <div className="inline">
          <Input
            label="Report month"
            id="report-month"
            type="month"
            value={monthValue}
            onChange={(event) => setMonthValue(event.target.value)}
          />
        </div>
      </header>

      <div className="stack-lg">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {loading ? (
          <div className="page-loader">Building your report…</div>
        ) : !report ? (
          <div className="card empty-finance">
            <span className="empty-art">
              <WalletIcon size={30} />
            </span>
            <h3>No report available</h3>
            <p>Choose a month to build a report from your stored records.</p>
          </div>
        ) : (
          <>
            <section
              className="stat-grid stat-grid-compact"
              aria-label="Report summary"
            >
              <div className="stat-card">
                <span className="stat-label">Income</span>
                <strong className="stat-value stat-value-positive">
                  {formatMoney(report.income, currency)}
                </strong>
                <span className="stat-hint">
                  {formatPercent(report.change.income_percent)} vs previous month
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Expenses</span>
                <strong className="stat-value stat-value-negative">
                  {formatMoney(report.expenses, currency)}
                </strong>
                <span className="stat-hint">
                  {formatPercent(report.change.expenses_percent)} vs previous
                  month
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Net</span>
                <strong className="stat-value">
                  {Number(report.net) >= 0 ? '+' : ''}
                  {formatMoney(report.net, currency)}
                </strong>
                <span className="stat-hint">
                  {report.transaction_count} transaction(s)
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Savings rate</span>
                <strong className="stat-value">
                  {report.savings_rate === null
                    ? '—'
                    : `${report.savings_rate.toFixed(1)}%`}
                </strong>
                <span className="stat-hint">Net income ÷ income</span>
              </div>
            </section>

            <section className="card" aria-labelledby="report-categories-title">
              <div className="card-header">
                <div>
                  <h2 className="card-title" id="report-categories-title">
                    Spending by category
                  </h2>
                  <p className="card-subtitle">
                    Expenses in {currency} for {report.period_start} to{' '}
                    {report.period_end}. Uncategorised records are grouped under
                    “uncategorised”.
                  </p>
                </div>
              </div>

              {report.category_breakdown.length === 0 ? (
                <p className="muted-note">
                  No transactions were recorded in this month.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col" className="align-right">
                          Income
                        </th>
                        <th scope="col" className="align-right">
                          Expenses
                        </th>
                        <th scope="col" className="align-right">
                          Share
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.category_breakdown.map((row) => (
                        <tr key={row.category}>
                          <td className="cell-primary">{row.category}</td>
                          <td className="align-right money">
                            {formatMoney(row.income, currency)}
                          </td>
                          <td className="align-right money money-negative">
                            {formatMoney(row.expenses, currency)}
                          </td>
                          <td className="align-right">{row.share_percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="dashboard-grid">
              <div className="dashboard-main">
                <section className="card" aria-labelledby="report-budgets-title">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title" id="report-budgets-title">
                        Budget performance
                      </h2>
                      <p className="card-subtitle">
                        Active budgets covering this month. Spending is computed
                        from stored expense transactions.
                      </p>
                    </div>
                  </div>

                  {report.budgets.length === 0 ? (
                    <p className="muted-note">
                      No active budget covers this month. Create one in Budgets
                      to track limits here.
                    </p>
                  ) : (
                    <ul className="data-list">
                      {report.budgets.map((budget) => (
                        <li className="data-list-item" key={budget.budget_id}>
                          <span className="cell-primary">{budget.name}</span>
                          <span className="cell-sub">
                            {formatMoney(budget.spent, budget.currency)} of{' '}
                            {formatMoney(budget.amount, budget.currency)} ·{' '}
                            {budget.percent_used}% used
                          </span>
                          <StatusBadge
                            status={budget.overspending ? 'overdue' : 'active'}
                            label={
                              budget.overspending ? 'Overspent' : 'On track'
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="card" aria-labelledby="report-merchants-title">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title" id="report-merchants-title">
                        Largest payees
                      </h2>
                      <p className="card-subtitle">
                        Expenses grouped by merchant or description.
                      </p>
                    </div>
                  </div>

                  {report.top_merchants.length === 0 ? (
                    <p className="muted-note">No expenses this month.</p>
                  ) : (
                    <ul className="data-list">
                      {report.top_merchants.map((merchant) => (
                        <li className="data-list-item" key={merchant.name}>
                          <span className="cell-primary">{merchant.name}</span>
                          <span className="cell-sub">
                            {merchant.count} payment(s)
                          </span>
                          <strong className="align-right money">
                            {formatMoney(merchant.amount, currency)}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <aside className="dashboard-side">
                <section
                  className="card"
                  aria-labelledby="report-comparison-title"
                >
                  <div className="card-header">
                    <div>
                      <h2 className="card-title" id="report-comparison-title">
                        Compared with last month
                      </h2>
                      <p className="card-subtitle">
                        {report.previous_period.year}-
                        {String(report.previous_period.month).padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                  <ul className="detail-list">
                    <li className="detail-row">
                      <span className="detail-label">Income</span>
                      <span className="detail-value money">
                        {formatMoney(report.previous_period.income, currency)}
                      </span>
                    </li>
                    <li className="detail-row">
                      <span className="detail-label">Expenses</span>
                      <span className="detail-value money">
                        {formatMoney(report.previous_period.expenses, currency)}
                      </span>
                    </li>
                    <li className="detail-row">
                      <span className="detail-label">Net</span>
                      <span className="detail-value money">
                        {formatMoney(report.previous_period.net, currency)}
                      </span>
                    </li>
                  </ul>
                </section>

                <section className="card" aria-labelledby="report-savings-title">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title" id="report-savings-title">
                        Savings goals
                      </h2>
                      <p className="card-subtitle">
                        Active goals in {report.savings.currency ?? currency}.
                      </p>
                    </div>
                  </div>
                  <ul className="detail-list">
                    <li className="detail-row">
                      <span className="detail-label">Goals</span>
                      <span className="detail-value">
                        {report.savings.goal_count}
                      </span>
                    </li>
                    <li className="detail-row">
                      <span className="detail-label">Saved</span>
                      <span className="detail-value money money-positive">
                        {formatMoney(
                          report.savings.total_saved,
                          report.savings.currency ?? currency,
                        )}
                      </span>
                    </li>
                    <li className="detail-row">
                      <span className="detail-label">Remaining</span>
                      <span className="detail-value money">
                        {formatMoney(
                          report.savings.remaining,
                          report.savings.currency ?? currency,
                        )}
                      </span>
                    </li>
                  </ul>
                </section>

                {otherCurrencies.length > 0 ? (
                  <section
                    className="card card-muted"
                    aria-labelledby="report-currencies-title"
                  >
                    <div className="card-header">
                      <div>
                        <h2
                          className="card-title"
                          id="report-currencies-title"
                        >
                          Other currencies
                        </h2>
                        <p className="card-subtitle">
                          Listed separately; no exchange rate is applied.
                        </p>
                      </div>
                    </div>
                    <ul className="data-list">
                      {otherCurrencies.map((code) => {
                        const totals = report.currency_breakdown[code]
                        return (
                          <li className="data-list-item" key={code}>
                            <span className="cell-primary">{code}</span>
                            <span className="cell-sub">
                              Income {formatMoney(totals.income, code)} ·
                              Expenses {formatMoney(totals.expenses, code)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ) : null}

                <div className="settings-note">
                  <InfoIcon size={15} />
                  <span>{report.notes.join(' ')}</span>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  )
}
