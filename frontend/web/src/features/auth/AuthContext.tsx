import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { authApi } from '../../services/authApi'
import {
  refreshAccessToken,
  SESSION_EXPIRED_EVENT,
  setAccessToken,
} from '../../services/apiClient'
import type { LoginInput, RegisterInput, User } from '../../services/types'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  /** True after an explicit sign-out, until the next successful authentication. */
  signedOutNotice: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  /**
   * Revokes the server session and clears local state. Rejects when the
   * server could not confirm revocation, leaving the browser session intact.
   */
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Browsers restore their session from the httpOnly refresh cookie. The
 * promise is shared so React StrictMode's double effect does not rotate the
 * refresh token twice concurrently.
 */
let bootstrapPromise: Promise<User | null> | null = null

function bootstrapSession(): Promise<User | null> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const token = await refreshAccessToken()
      if (!token) return null
      setAccessToken(token)
      try {
        return await authApi.me()
      } catch {
        setAccessToken(null)
        return null
      }
    })().finally(() => {
      bootstrapPromise = null
    })
  }
  return bootstrapPromise
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [signedOutNotice, setSignedOutNotice] = useState(false)

  useEffect(() => {
    let active = true

    bootstrapSession()
      .then((restoredUser) => {
        if (!active) return
        setUser((current) => current ?? restoredUser)
        setStatus((current) => {
          if (current !== 'loading') return current
          return restoredUser ? 'authenticated' : 'unauthenticated'
        })
      })
      .catch(() => {
        if (active) setStatus('unauthenticated')
      })

    const handleExpired = () => {
      setAccessToken(null)
      setUser(null)
      setStatus('unauthenticated')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired)

    return () => {
      active = false
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired)
    }
  }, [])

  const completeAuthentication = useCallback(
    (response: { access_token: string; user: User }) => {
      setAccessToken(response.access_token)
      setUser(response.user)
      setStatus('authenticated')
      setSignedOutNotice(false)
    },
    [],
  )

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await authApi.login(input)
      completeAuthentication(response)
    },
    [completeAuthentication],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await authApi.register(input)
      completeAuthentication(response)
    },
    [completeAuthentication],
  )

  const logoutPromise = useRef<Promise<void> | null>(null)

  const logout = useCallback(() => {
    const inFlight = logoutPromise.current
    if (inFlight) return inFlight

    // The browser refresh token lives in an HttpOnly cookie that only the
    // backend can clear. If revocation fails, the session is still active, so
    // keep the authenticated state and let the caller report the failure
    // instead of showing a false sign-out confirmation.
    const operation = (async () => {
      await authApi.logout()
      setAccessToken(null)
      setUser(null)
      setStatus('unauthenticated')
      setSignedOutNotice(true)
    })().finally(() => {
      logoutPromise.current = null
    })

    logoutPromise.current = operation
    return operation
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
      signedOutNotice,
      login,
      register,
      logout,
      refreshUser,
      updateUser,
    }),
    [
      user,
      status,
      signedOutNotice,
      login,
      register,
      logout,
      refreshUser,
      updateUser,
    ],
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
