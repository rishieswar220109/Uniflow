import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthContextValue } from '../features/auth/AuthContext'
import { RegisterPage } from '../pages/RegisterPage'

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<div>Dashboard screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
  options: { confirmPassword?: string } = {},
) {
  await user.type(screen.getByLabelText(/^Full name/), '  Asha   Verma ')
  await user.type(screen.getByLabelText(/^Email address/), 'Asha@Example.com')
  await user.type(screen.getByLabelText(/^Password/), 'Guardian123')
  await user.type(
    screen.getByLabelText(/^Confirm password/),
    options.confirmPassword ?? 'Guardian123',
  )
}

describe('registration form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows understandable validation messages', async () => {
    const user = userEvent.setup()
    auth.useAuth.mockReturnValue(makeAuth())
    renderPage()

    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(screen.getByText('Confirm your password.')).toBeInTheDocument()
  })

  it('rejects mismatched passwords before calling the API', async () => {
    const user = userEvent.setup()
    const register = vi.fn(async () => undefined)
    auth.useAuth.mockReturnValue(makeAuth({ register }))
    renderPage()

    await fillValidForm(user, { confirmPassword: 'Guardian124' })
    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('submits normalised values and navigates to the dashboard', async () => {
    const user = userEvent.setup()
    const register = vi.fn(async () => undefined)
    auth.useAuth.mockReturnValue(makeAuth({ register }))
    renderPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        full_name: 'Asha Verma',
        email: 'asha@example.com',
        password: 'Guardian123',
      })
    })
    expect(await screen.findByText('Dashboard screen')).toBeInTheDocument()
  })

  it('shows API errors such as a duplicate email', async () => {
    const user = userEvent.setup()
    const register = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Request failed'), {
          isAxiosError: true,
          response: {
            status: 409,
            data: { detail: 'An account with this email already exists' },
          },
        }),
      )
    auth.useAuth.mockReturnValue(makeAuth({ register }))
    renderPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /^create account$/i }))

    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^create account$/i })).toBeEnabled()
  })
})
