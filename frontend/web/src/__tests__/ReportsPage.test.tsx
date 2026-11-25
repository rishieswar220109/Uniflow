import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ReportsPage } from '../pages/ReportsPage'
import type { FinancialReport } from '../services/types'

const api = vi.hoisted(() => ({
  getFinancialReport: vi.fn(),
}))

vi.mock('../services/financeApi', () => ({ financeApi: api }))

function makeReport(overrides: Partial<FinancialReport> = {}): FinancialReport {
  return {
    year: 2026,
    month: 11,
    period_start: '2026-11-01',
    period_end: '2026-11-30',
    generated_at: '2026-11-23',
    currency: 'INR',
    income: '50000.00',
    expenses: '3000.00',
    net: '47000.00',
    savings_rate: 94,
    transaction_count: 2,
    category_breakdown: [
      {
        category: 'groceries',
        income: '0.00',
        expenses: '3000.00',
        share_percent: 100,
      },
    ],
    top_merchants: [{ name: 'BigBasket', amount: '3000.00', count: 1 }],
    previous_period: {
      year: 2026,
      month: 10,
      income: '45000.00',
      expenses: '4000.00',
      net: '41000.00',
    },
    change: {
      income_percent: 11.11,
      expenses_percent: -25,
      net_percent: 14.63,
    },
    budgets: [
      {
        budget_id: 'budget-1',
        name: 'November groceries',
        period: '2026-11-01 to 2026-11-30',
        amount: '5000.00',
        currency: 'INR',
        spent: '3000.00',
        remaining: '2000.00',
        alert_threshold: 80,
        overspending: false,
        percent_used: 60,
        category_id: null,
      },
    ],
    savings: {
      currency: 'INR',
      total_target: '100000.00',
      total_saved: '50000.00',
      remaining: '50000.00',
      goal_count: 1,
      currency_breakdown: {
        INR: {
          total_target: '100000.00',
          total_saved: '50000.00',
          remaining: '50000.00',
          goal_count: 1,
        },
      },
    },
    currency_breakdown: {
      INR: { income: '50000.00', expenses: '3000.00', count: 2 },
    },
    notes: [
      'Totals are reported in INR only.',
      'Amounts in other currencies are listed separately; no exchange rate is applied.',
    ],
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ReportsPage />
    </MemoryRouter>,
  )
}

describe('financial reports page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders real month totals, categories and budget performance', async () => {
    api.getFinancialReport.mockResolvedValue(makeReport())
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Monthly report' }),
    ).toBeInTheDocument()
    expect(api.getFinancialReport).toHaveBeenCalledWith({
      year: expect.any(Number),
      month: expect.any(Number),
    })

    expect(await screen.findByText('groceries')).toBeInTheDocument()
    expect(screen.getByText('November groceries')).toBeInTheDocument()
    expect(screen.getAllByText(/vs previous month/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/no exchange rate is applied/i)).toBeInTheDocument()
    expect(screen.getByText('BigBasket')).toBeInTheDocument()
    expect(screen.getByText('94.0%')).toBeInTheDocument()
  })

  it('lists other currencies separately when the report is mixed', async () => {
    api.getFinancialReport.mockResolvedValue(
      makeReport({
        currency_breakdown: {
          INR: { income: '50000.00', expenses: '3000.00', count: 2 },
          USD: { income: '0.00', expenses: '40.00', count: 1 },
        },
      }),
    )
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Other currencies' }),
    ).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
  })

  it('shows an error when the report cannot be loaded', async () => {
    api.getFinancialReport.mockRejectedValue(new Error('report unavailable'))
    renderPage()

    expect(
      await screen.findByText(/report unavailable/i),
    ).toBeInTheDocument()
  })
})
