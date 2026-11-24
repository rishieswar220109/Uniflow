import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SpendingPreferencesPage } from '../pages/SpendingPreferencesPage'
import type { SpendingPreferences } from '../services/types'

const api = vi.hoisted(() => ({
  getSpendingPreferences: vi.fn(),
  updateSpendingPreferences: vi.fn(),
}))

vi.mock('../services/financeApi', () => ({ financeApi: api }))

function makePreferences(
  overrides: Partial<SpendingPreferences> = {},
): SpendingPreferences {
  return {
    id: 'pref-1',
    user_id: 'user-1',
    proactive_awareness_enabled: true,
    significant_spending_threshold: '5000.00',
    reminder_advance_days: 3,
    enable_due_reminders: true,
    enable_post_payment_reminders: false,
    enable_entertainment_alerts: true,
    entertainment_categories: 'Entertainment, Dining',
    reminder_frequency: 'daily',
    currency: 'INR',
    created_at: '2026-01-02T10:00:00Z',
    updated_at: '2026-01-02T10:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SpendingPreferencesPage />
    </MemoryRouter>,
  )
}

describe('spending preferences page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads every stored preference into the form', async () => {
    api.getSpendingPreferences.mockResolvedValue(makePreferences())
    renderPage()

    expect(
      await screen.findByLabelText(/Significant spending threshold/i),
    ).toHaveValue(5000)
    expect(screen.getByLabelText(/Advance reminder days/i)).toHaveValue(3)
    expect(screen.getByLabelText(/Entertainment categories/i)).toHaveValue(
      'Entertainment, Dining',
    )
    expect(screen.getByLabelText('Currency')).toHaveValue('INR')
    expect(screen.getByLabelText('Reminder frequency')).toHaveValue('daily')
  })

  it('saves the submitted preferences through the API', async () => {
    const user = userEvent.setup()
    api.getSpendingPreferences.mockResolvedValue(makePreferences())
    api.updateSpendingPreferences.mockImplementation(
      async (input: Record<string, unknown>) =>
        makePreferences({ ...input } as Partial<SpendingPreferences>),
    )
    renderPage()

    const threshold = await screen.findByLabelText(
      /Significant spending threshold/i,
    )
    await user.clear(threshold)
    await user.type(threshold, '7500')
    await user.click(
      screen.getByRole('button', { name: /Save spending preferences/i }),
    )

    await waitFor(() =>
      expect(api.updateSpendingPreferences).toHaveBeenCalledTimes(1),
    )
    const payload = api.updateSpendingPreferences.mock.calls[0][0]
    expect(payload.significant_spending_threshold).toBe('7500.00')
    expect(payload.reminder_advance_days).toBe(3)
    expect(payload.enable_post_payment_reminders).toBe(false)
    expect(payload.entertainment_categories).toBe('Entertainment, Dining')
    expect(payload.currency).toBe('INR')
    expect(
      await screen.findByText('Spending preferences saved.'),
    ).toBeInTheDocument()
  })

  it('rejects an invalid threshold without calling the API', async () => {
    const user = userEvent.setup()
    api.getSpendingPreferences.mockResolvedValue(makePreferences())
    renderPage()

    const threshold = await screen.findByLabelText(
      /Significant spending threshold/i,
    )
    await user.clear(threshold)
    await user.type(threshold, '0')
    await user.click(
      screen.getByRole('button', { name: /Save spending preferences/i }),
    )

    expect(
      await screen.findByText(
        'Enter a significant spending threshold greater than zero.',
      ),
    ).toBeInTheDocument()
    expect(api.updateSpendingPreferences).not.toHaveBeenCalled()
  })

  it('shows an error state when preferences cannot be loaded', async () => {
    api.getSpendingPreferences.mockRejectedValue(new Error('boom'))
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('boom')
    expect(
      screen.queryByRole('button', { name: /Save spending preferences/i }),
    ).not.toBeInTheDocument()
  })
})
