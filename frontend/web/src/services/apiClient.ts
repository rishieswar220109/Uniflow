import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const SESSION_EXPIRED_EVENT = 'guardian:session-expired'

/**
 * The access token lives only in memory. Long-lived refresh tokens are stored
 * in an httpOnly cookie by the backend, never in localStorage.
 */
let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'web',
  },
  timeout: 20000,
})

// A separate client for refresh avoids interceptor recursion.
const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'web',
  },
  timeout: 20000,
})

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
  )
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<{ access_token: string }>('/auth/refresh')
      .then((response) => {
        setAccessToken(response.data.access_token)
        return response.data.access_token
      })
      .catch(() => {
        setAccessToken(null)
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthEndpoint(original.url)
    ) {
      original._retry = true
      const token = await refreshAccessToken()
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
      }
    }

    return Promise.reject(error)
  },
)
