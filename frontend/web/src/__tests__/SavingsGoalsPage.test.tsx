import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SavingsGoalsPage } from '../pages/SavingsGoalsPage'
import type { SavingsGoal } from '../services/types'

const api = vi.hoisted(() => ({
  getSavingsGoals: vi.fn(),
  getSavingsGoalsSummary: vi.fn(),
  createSavingsGoal: vi.fn(),
  updateSavingsGoal: vi.fn(),
  deleteSavingsGoal: vi.fn(),
}))

vi.mock('../services/financeApi', () => ({ financeApi: api }))

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'goal-1',
    name: 'Emergency fund',
    target_amount: '100000.00',
    current_amount: '50000.00',
    currency: 'INR',
    target_date: '2027-03-31',
    is_active: true,
    remaining: '50000.00',
    percent_funded: 50,
    created_at: '2026-01-02T10:00:00Z',
    updated_at: '2026-01-02T10:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SavingsGoalsPage />
    </MemoryRouter>,
  )
}

describe('savings goals page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists goals with their progress and totals', async () => {
    api.getSavingsGoals.mockResolvedValue({
      items: [makeGoal()],
      total: 1,
      limit: 100,
      offset: 0,
    })
    api.getSavingsGoalsSummary.mockResolvedValue({
      total_target: '100000.00',
      total_saved: '50000.00',
      remaining: '50000.00',
      goal_count: 1,
    })
    renderPage()

    expect(await screen.findByText('Emergency fund')).toBeInTheDocument()
    expect(screen.getByText('50.0%')).toBeInTheDocument()
    expect(screen.getByText('50.0% funded')).toBeInTheDocument()
  })

  it('shows an empty state when there are no goals', async () => {
    api.getSavingsGoals.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
    })
    api.getSavingsGoalsSummary.mockResolvedValue({
      total_target: '0.00',
      total_saved: '0.00',
      remaining: '0.00',
      goal_count: 0,
    })
    renderPage()

    expect(await screen.findByText('No savings goals yet')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Create your first goal/i }),
    ).toBeInTheDocument()
  })

  it('validates the target amount before creating a goal', async () => {
    const user = userEvent.setup()
    api.getSavingsGoals.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
    })
    api.getSavingsGoalsSummary.mockResolvedValue({
      total_target: '0.00',
      total_saved: '0.00',
      remaining: '0.00',
      goal_count: 0,
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: /New goal/i }))
    await user.type(screen.getByLabelText(/Goal name/i), 'New laptop')
    await user.click(screen.getByRole('button', { name: /Save goal/i }))

    expect(
      await screen.findByText('Enter a target amount greater than zero.'),
    ).toBeInTheDocument()
    expect(api.createSavingsGoal).not.toHaveBeenCalled()
  })

  it('creates a goal with the entered values', async () => {
    const user = userEvent.setup()
    api.getSavingsGoals.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
    })
    api.getSavingsGoalsSummary.mockResolvedValue({
      total_target: '0.00',
      total_saved: '0.00',
      remaining: '0.00',
      goal_count: 0,
    })
    api.createSavingsGoal.mockResolvedValue(makeGoal({ name: 'New laptop' }))
    renderPage()

    await user.click(await screen.findByRole('button', { name: /New goal/i }))
    await user.type(screen.getByLabelText(/Goal name/i), 'New laptop')
    await user.type(screen.getByLabelText(/Target amount/i), '120000')
    await user.click(screen.getByRole('button', { name: /Save goal/i }))

    await waitFor(() =>
      expect(api.createSavingsGoal).toHaveBeenCalledWith({
        name: 'New laptop',
        target_amount: '120000.00',
        currency: 'INR',
        target_date: null,
        is_active: true,
      }),
    )
    expect(await screen.findByText('Savings goal created.')).toBeInTheDocument()
  })
})
