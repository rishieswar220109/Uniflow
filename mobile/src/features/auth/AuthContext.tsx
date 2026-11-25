import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { authApi } from '../../services/authApi'
import {
  clearLocalSession,
  finishSession,
  onSessionExpired,
  refreshSession,
  setAccessToken,
  startSession,
} from '../../services/apiClient'
import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  User,
} from '../../services/types'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  /**
   * Revokes the server session and clears device credentials. Rejects when the
   * server could not confirm revocation; device credentials are still cleared.
   */
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let active = true

    refreshSession()
      .then((session) => {
        if (!active) return
        if (session) {
          setUser(session.user)
          setStatus('authenticated')
        } else {
          setStatus('unauthenticated')
        }
      })
      .catch(() => {
        if (active) setStatus('unauthenticated')
      })

    const unsubscribe = onSessionExpired(() => {
      setAccessToken(null)
      void clearLocalSession()
      setUser(null)
      setStatus('unauthenticated')
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const completeAuthentication = useCallback(async (response: AuthResponse) => {
    await startSession(response)
    setUser(response.user)
    setStatus('authenticated')
  }, [])

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await authApi.login(input)
      await completeAuthentication(response)
    },
    [completeAuthentication],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await authApi.register(input)
      await completeAuthentication(response)
    },
    [completeAuthentication],
  )

  const logout = useCallback(async () => {
    try {
      await finishSession()
    } finally {
      // Local state is cleared even when server revocation cannot be
      // confirmed. finishSession rejects so the UI can report that clearly.
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const freshUser = await authApi.me()
    setUser(freshUser)
    setStatus('authenticated')
  }, [])

  const updateUser = useCallback((updated: User) => {
    setUser(updated)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      refreshUser,
      updateUser,
    }),
    [user, status, login, register, logout, refreshUser, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
