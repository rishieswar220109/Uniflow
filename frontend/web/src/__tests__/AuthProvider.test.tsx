import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from '../features/auth/AuthContext'
import { authApi } from '../services/authApi'
import {
  refreshAccessToken,
  setAccessToken,
} from '../services/apiClient'
import type { AuthResponse } from '../services/types'
import { makeAuthResponse, makeUser } from '../test/fixtures'

const apiMocks = vi.hoisted(() => ({
  refreshAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
}))

vi.mock('../services/apiClient', () => ({
  refreshAccessToken: apiMocks.refreshAccessToken,
  setAccessToken: apiMocks.setAccessToken,
  SESSION_EXPIRED_EVENT: 'guardian:session-expired',
}))

const authApiMocks = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../services/authApi', () => ({ authApi: authApiMocks }))

const refreshMock = vi.mocked(refreshAccessToken)
const setTokenMock = vi.mocked(setAccessToken)
const loginMock = vi.mocked(authApi.login)
const logoutMock = vi.mocked(authApi.logout)
const meMock = vi.mocked(authApi.me)

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe('authentication state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshMock.mockResolvedValue(null)
    logoutMock.mockResolvedValue(undefined)
  })

  it('starts unauthenticated when no refresh cookie exists', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated')
    })
    expect(result.current.user).toBeNull()
  })

  it('restores a session from the refresh cookie', async () => {
    refreshMock.mockResolvedValue('restored-token')
    meMock.mockResolvedValue(makeUser())

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('authenticated')
    })
    expect(result.current.user?.email).toBe('asha@example.com')
    expect(setTokenMock).toHaveBeenCalledWith('restored-token')
  })

  it('logs in and stores the access token only in memory', async () => {
    loginMock.mockResolvedValue(makeAuthResponse() as AuthResponse)
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))

    await act(async () => {
      await result.current.login({
        email: 'asha@example.com',
        password: 'Guardian123',
      })
    })

    expect(result.current.status).toBe('authenticated')
    expect(result.current.user?.full_name).toBe('Asha Verma')
    expect(setTokenMock).toHaveBeenCalledWith('test-access-token')
  })

  it('clears the session and token on logout', async () => {
    loginMock.mockResolvedValue(makeAuthResponse())
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
    await act(async () => {
      await result.current.login({
        email: 'asha@example.com',
        password: 'Guardian123',
      })
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(logoutMock).toHaveBeenCalled()
    expect(setTokenMock).toHaveBeenLastCalledWith(null)
    expect(result.current.status).toBe('unauthenticated')
    expect(result.current.user).toBeNull()
    expect(result.current.signedOutNotice).toBe(true)
  })

  it('clears the sign-out notice after signing back in', async () => {
    loginMock.mockResolvedValue(makeAuthResponse())
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))

    await act(async () => {
      await result.current.logout()
    })
    expect(result.current.signedOutNotice).toBe(true)

    await act(async () => {
      await result.current.login({
        email: 'asha@example.com',
        password: 'Guardian123',
      })
    })
    expect(result.current.signedOutNotice).toBe(false)
  })

  it('clears local state when the API reports an expired session', async () => {
    loginMock.mockResolvedValue(makeAuthResponse())
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
    await act(async () => {
      await result.current.login({
        email: 'asha@example.com',
        password: 'Guardian123',
      })
    })

    act(() => {
      window.dispatchEvent(new Event('guardian:session-expired'))
    })

    expect(result.current.status).toBe('unauthenticated')
    expect(result.current.user).toBeNull()
  })
})
