import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import {
  ProtectedRoute,
  PublicOnlyRoute,
} from '../components/ProtectedRoute'
import type { AuthContextValue } from '../features/auth/AuthContext'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../features/auth/AuthContext', () => ({ useAuth: auth.useAuth }))

const noop = vi.fn(async () => undefined)

const baseAuth: AuthContextValue = {
  user: null,
  status: 'unauthenticated',
  signedOutNotice: false,
  login: noop,
  register: noop,
  logout: noop,
  refreshUser: noop,
  updateUser: vi.fn(),
}

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Dashboard screen</div>} />
        </Route>
        <Route path="/login" element={<div>Login screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderPublicOnly() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<div>Login screen</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('protected route behaviour', () => {
  it('redirects unauthenticated visitors to login', () => {
    auth.useAuth.mockReturnValue(baseAuth)
    renderProtected()
    expect(screen.getByText('Login screen')).toBeInTheDocument()
  })

  it('shows a loading state while the session is checked', () => {
    auth.useAuth.mockReturnValue({ ...baseAuth, status: 'loading' })
    renderProtected()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
  })

  it('renders protected content for authenticated users', () => {
    auth.useAuth.mockReturnValue({
      ...baseAuth,
      status: 'authenticated',
      user: null,
    })
    renderProtected()
    expect(screen.getByText('Dashboard screen')).toBeInTheDocument()
  })

  it('keeps authenticated users out of login and register screens', () => {
    auth.useAuth.mockReturnValue({
      ...baseAuth,
      status: 'authenticated',
    })
    renderPublicOnly()
    expect(screen.getByText('Dashboard screen')).toBeInTheDocument()
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument()
  })

  it('shows login to unauthenticated users', () => {
    auth.useAuth.mockReturnValue(baseAuth)
    renderPublicOnly()
    expect(screen.getByText('Login screen')).toBeInTheDocument()
  })
})
