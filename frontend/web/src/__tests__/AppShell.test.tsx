import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from '../components/layout/AppShell'
import type { AuthContextValue } from '../features/auth/AuthContext'
import { makeUser } from '../test/fixtures'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../features/auth/AuthContext', () => ({ useAuth: auth.useAuth }))

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: makeUser(),
    status: 'authenticated',
    signedOutNotice: false,
    login: vi.fn(async () => undefined),
    register: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    refreshUser: vi.fn(async () => undefined),
    updateUser: vi.fn(),
    ...overrides,
  }
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<div>Dashboard screen</div>} />
        </Route>
        <Route path="/login" element={<div>Login screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function clickSignOut(user: ReturnType<typeof userEvent.setup>) {
  const buttons = screen.getAllByRole('button', { name: /sign out/i })
  await user.click(buttons[0])
}

describe('app shell navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.useAuth.mockReturnValue(makeAuth())
  })

  it('links Budgets and Intelligence and drops the disabled Phase 3 entry', () => {
    renderShell()

    expect(screen.getByRole('link', { name: 'Budgets' })).toHaveAttribute(
      'href',
      '/budgets',
    )
    expect(screen.getByRole('link', { name: 'Intelligence' })).toHaveAttribute(
      'href',
      '/intelligence',
    )
    expect(screen.queryByText('Insights')).not.toBeInTheDocument()
    expect(screen.getByText('Phase 3 · Financial intelligence')).toBeInTheDocument()
  })
})

describe('app shell sign-out', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('navigates to login after a confirmed sign-out', async () => {
    const user = userEvent.setup()
    const logout = vi.fn(async () => undefined)
    auth.useAuth.mockReturnValue(makeAuth({ logout }))
    renderShell()

    await clickSignOut(user)

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Login screen')).toBeInTheDocument()
  })

  it('keeps the session and shows an error when revocation fails', async () => {
    const user = userEvent.setup()
    const logout = vi.fn().mockRejectedValue(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 503, data: {} },
      }),
    )
    auth.useAuth.mockReturnValue(makeAuth({ logout }))
    renderShell()

    await clickSignOut(user)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('We could not confirm your sign-out.')
    expect(alert).toHaveTextContent('Your session may still be active.')
    expect(alert).toHaveTextContent('The service is temporarily unavailable.')

    expect(screen.getByText('Dashboard screen')).toBeInTheDocument()
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument()
  })

  it('explains a network failure without leaving the page', async () => {
    const user = userEvent.setup()
    const logout = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Network Error'), { isAxiosError: true }),
      )
    auth.useAuth.mockReturnValue(makeAuth({ logout }))
    renderShell()

    await clickSignOut(user)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Unable to reach the server.')
    expect(screen.getByText('Dashboard screen')).toBeInTheDocument()
  })
})
