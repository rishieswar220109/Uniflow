import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthContextValue } from '../features/auth/AuthContext'
import { LoginPage } from '../pages/LoginPage'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../features/auth/AuthContext', () => ({ useAuth: auth.useAuth }))

const noop = vi.fn(async () => undefined)

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    status: 'unauthenticated',
    signedOutNotice: false,
    login: noop,
    register: noop,
    logout: noop,
    refreshUser: noop,
    updateUser: vi.fn(),
    ...overrides,
  }
}

function renderPage(state?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Email address/), 'asha@example.com')
  await user.type(screen.getByLabelText(/^Password/), 'Guardian123')
}

describe('login form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates empty fields', async () => {
    const user = userEvent.setup()
    auth.useAuth.mockReturnValue(makeAuth())
    renderPage()

    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
  })

  it('signs in and navigates to the requested page', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => undefined)
    auth.useAuth.mockReturnValue(makeAuth({ login }))
    renderPage({ from: { pathname: '/dashboard' } })

    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(login).toHaveBeenCalledWith({
      email: 'asha@example.com',
      password: 'Guardian123',
    })
    expect(await screen.findByText('Dashboard screen')).toBeInTheDocument()
  })

  it('shows invalid credential errors from the API', async () => {
    const user = userEvent.setup()
    const login = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Request failed'), {
          isAxiosError: true,
          response: {
            status: 401,
            data: { detail: 'Incorrect email or password' },
          },
        }),
      )
    auth.useAuth.mockReturnValue(makeAuth({ login }))
    renderPage()

    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(
      await screen.findByText('Incorrect email or password'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email address/)).toHaveValue(
      'asha@example.com',
    )
  })

  it('confirms a secure sign-out', () => {
    auth.useAuth.mockReturnValue(makeAuth({ signedOutNotice: true }))
    renderPage()

    expect(
      screen.getByText('You have been signed out securely on this device.'),
    ).toBeInTheDocument()
  })

  it('hides the sign-out notice during a normal visit', () => {
    auth.useAuth.mockReturnValue(makeAuth())
    renderPage()

    expect(
      screen.queryByText('You have been signed out securely on this device.'),
    ).not.toBeInTheDocument()
  })
})
