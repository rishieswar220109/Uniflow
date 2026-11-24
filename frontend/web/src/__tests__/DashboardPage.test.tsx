import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthContextValue } from '../features/auth/AuthContext'
import { DashboardPage } from '../pages/DashboardPage'
import type {
  CashFlowForecast,
  FinancialInsight,
  Summary,
} from '../services/types'
import { makeUser } from '../test/fixtures'

const api = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getCashFlowForecast: vi.fn(),
  listInsights: vi.fn(),
}))

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../services/financeApi', () => ({ financeApi: api }))
vi.mock('../features/auth/AuthContext', () => ({ useAuth: auth.useAuth }))

function makeSummary(overrides: Partial<Summary> = {}): Summary {
  return {
    currency: 'INR',
    total_balance: '120000.00',
    total_available: '118000.00',
    accounts_count: 1,
    connected_accounts_count: 1,
    is_mock_data: true,
    month_income: '60000.00',
    month_expenses: '24000.00',
    net_this_month: '36000.00',
    upcoming_total: '8000.00',
    upcoming_bills_count: 2,
    upcoming_subscriptions_count: 1,
    upcoming_payments: [],
    recent_transactions: [],
    last_synced_at: '2026-11-20T10:00:00Z',
    ...overrides,
  }
}

function makeForecast(
  overrides: Partial<CashFlowForecast> = {},
): CashFlowForecast {
  return {
    days: 30,
    start_date: '2026-11-22',
    end_date: '2026-12-22',
    available_balance: '118000.00',
    expected_income: '60000.00',
    expected_expenses: '9000.00',
    projected_balance: '169000.00',
    currency: 'INR',
    upcoming_obligations: [],
    daily_projection: [],
    assumptions: 'Income is estimated from recent recurring credits.',
    ...overrides,
  }
}

function makeInsight(
  overrides: Partial<FinancialInsight> = {},
): FinancialInsight {
  return {
    id: 'insight-1',
    insight_type: 'low_balance',
    severity: 'warning',
    title: 'Low balance expected',
    description: 'Your projected balance falls below the safety line.',
    amount: '2000.00',
    currency: 'INR',
    related_date: '2026-12-01',
    is_dismissed: false,
    created_at: '2026-11-22T10:00:00Z',
    updated_at: '2026-11-22T10:00:00Z',
    ...overrides,
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('dashboard Phase 3 additions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.useAuth.mockReturnValue({
      user: makeUser(),
      status: 'authenticated',
      signedOutNotice: false,
      login: vi.fn(async () => undefined),
      register: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
      refreshUser: vi.fn(async () => undefined),
      updateUser: vi.fn(),
    } as AuthContextValue)
    api.getSummary.mockResolvedValue(makeSummary())
    api.getCashFlowForecast.mockResolvedValue(makeForecast())
    api.listInsights.mockResolvedValue({
      items: [
        makeInsight({
          id: 'insight-info',
          severity: 'info',
          title: 'Spending pattern stable',
          description: 'Spending is stable compared with last month.',
        }),
        makeInsight(),
      ],
      total: 2,
      limit: 5,
      offset: 0,
    })
  })

  it('shows the projected balance from the forecast', async () => {
    renderDashboard()

    expect(
      await screen.findByText('Projected balance'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Predicted in 30 days from recorded income/),
    ).toBeInTheDocument()
  })

  it('omits the projection when the forecast has no reliable inputs', async () => {
    api.getCashFlowForecast.mockResolvedValue(
      makeForecast({
        available_balance: '0.00',
        expected_income: '0.00',
        expected_expenses: '0.00',
        projected_balance: '0.00',
      }),
    )
    renderDashboard()

    expect(await screen.findByText(/Welcome back/)).toBeInTheDocument()
    expect(screen.queryByText('Projected balance')).not.toBeInTheDocument()
  })

  it('surfaces the most severe insight', async () => {
    renderDashboard()

    expect(await screen.findByText('Low balance expected')).toBeInTheDocument()
    expect(screen.queryByText('Spending pattern stable')).not.toBeInTheDocument()
  })

  it('marks Ask UniFlow as an unavailable Phase 4 capability', async () => {
    renderDashboard()

    expect(
      await screen.findByRole('heading', { name: 'Ask UniFlow' }),
    ).toBeInTheDocument()
    const button = screen.getByRole('button', {
      name: /Ask UniFlow — coming in Phase 4/,
    })
    expect(button).toBeDisabled()
  })
})
