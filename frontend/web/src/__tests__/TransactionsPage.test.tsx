import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TransactionsPage } from '../pages/TransactionsPage'
import type {
  FinancialAccount,
  ProactiveAwareness,
  Transaction,
} from '../services/types'

const api = vi.hoisted(() => ({
  getAccounts: vi.fn(),
  getCategories: vi.fn(),
  getTransactions: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  checkProactiveAwareness: vi.fn(),
}))

vi.mock('../services/financeApi', () => ({ financeApi: api }))

function makeAccount(): FinancialAccount {
  return {
    id: 'account-1',
    connection_id: 'connection-1',
    name: 'Everyday checking',
    account_type: 'checking',
    currency: 'INR',
    balance: '120000.00',
    available_balance: '118000.00',
    is_active: true,
    is_mock: true,
    last_synced_at: '2026-11-22T10:00:00Z',
    created_at: '2026-11-01T10:00:00Z',
  }
}

function makeAwareness(): ProactiveAwareness {
  return {
    significant_spending: true,
    transaction_amount: '12000.00',
    currency: 'INR',
    available_balance: '118000.00',
    remaining_after_spending: '106000.00',
    upcoming_dues: [
      {
        kind: 'bill',
        id: 'bill-1',
        name: 'Rent',
        amount: '25000.00',
        due_date: '2026-11-25',
        currency: 'INR',
      },
    ],
    upcoming_total: '25000.00',
    insufficient_after_spending: false,
    advice:
      'After this spending, you would have INR 106000.00 available against 25000.00 in upcoming obligations.',
  }
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    account_id: 'account-1',
    account: {
      id: 'account-1',
      name: 'Everyday checking',
      account_type: 'checking',
    },
    category: null,
    amount: '-12000.00',
    currency: 'INR',
    description: 'Designer furniture',
    merchant: 'Luxury Store',
    occurred_on: '2026-11-23',
    transaction_type: 'expense',
    source: 'manual',
    is_pending: false,
    notes: null,
    created_at: '2026-11-23T09:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TransactionsPage />
    </MemoryRouter>,
  )
}

async function fillTransactionForm() {
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: /Add transaction/i }),
  )
  // The form only renders its fields once the account list has loaded.
  const amount = await screen.findByLabelText(/Amount/i)
  await user.type(amount, '-12000')
  await user.type(screen.getByLabelText(/Description/i), 'Designer furniture')
  await user.type(screen.getByLabelText('Merchant'), 'Luxury Store')
  return user
}

describe('transaction spending awareness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getAccounts.mockResolvedValue([makeAccount()])
    api.getCategories.mockResolvedValue([])
    api.getTransactions.mockResolvedValue({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
    })
    api.updateTransaction.mockResolvedValue(makeTransaction())
    api.deleteTransaction.mockResolvedValue(undefined)
    renderPage()
  })

  it('shows stored awareness before storing significant spending', async () => {
    api.checkProactiveAwareness.mockResolvedValue(makeAwareness())
    const user = await fillTransactionForm()

    await user.click(
      screen.getByRole('button', { name: /Record transaction/i }),
    )

    expect(
      await screen.findByText('Spending awareness'),
    ).toBeInTheDocument()
    expect(screen.getByText(/upcoming obligations/i)).toBeInTheDocument()
    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(api.createTransaction).not.toHaveBeenCalled()
    expect(api.checkProactiveAwareness).toHaveBeenCalledWith({
      transaction_amount: '12000.00',
      transaction_category: null,
    })
  })

  it('records the transaction after the user confirms', async () => {
    api.checkProactiveAwareness.mockResolvedValue(makeAwareness())
    api.createTransaction.mockResolvedValue(
      makeTransaction({
        alerts: [
          {
            id: 'insight-1',
            insight_type: 'significant_spending',
            severity: 'warning',
            title: 'Significant spending: Luxury Store',
            description: 'Recorded above the threshold.',
            amount: '12000.00',
            currency: 'INR',
            related_date: '2026-11-23',
            is_dismissed: false,
            created_at: '2026-11-23T09:00:00Z',
            updated_at: '2026-11-23T09:00:00Z',
          },
        ],
      }),
    )
    const user = await fillTransactionForm()

    await user.click(
      screen.getByRole('button', { name: /Record transaction/i }),
    )
    await user.click(
      await screen.findByRole('button', { name: /Record anyway/i }),
    )

    await waitFor(() => expect(api.createTransaction).toHaveBeenCalled())
    expect(
      await screen.findByText(/UniFlow stored 1 insight/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/No push, email or SMS notification is sent/i),
    ).toBeInTheDocument()
  })

  it('records directly when awareness reports nothing significant', async () => {
    api.checkProactiveAwareness.mockResolvedValue(null)
    api.createTransaction.mockResolvedValue(makeTransaction())
    const user = await fillTransactionForm()

    await user.click(
      screen.getByRole('button', { name: /Record transaction/i }),
    )

    await waitFor(() => expect(api.createTransaction).toHaveBeenCalled())
    expect(screen.queryByText('Spending awareness')).not.toBeInTheDocument()
  })
})
