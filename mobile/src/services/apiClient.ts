import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

import type { AuthResponse } from './types'
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  storeRefreshToken,
} from './secureStorage'

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
).replace(/\/$/, '')

const CLIENT_HEADERS = {
  'Content-Type': 'application/json',
  'X-Client-Platform': 'mobile',
}

/**
 * Access tokens stay in memory. The rotating refresh token is kept in the
 * device keychain/keystore through expo-secure-store.
 */
let accessToken: string | null = null
let refreshPromise: Promise<AuthResponse | null> | null = null
const expiryListeners = new Set<() => void>()

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function onSessionExpired(listener: () => void): () => void {
  expiryListeners.add(listener)
  return () => expiryListeners.delete(listener)
}

function notifySessionExpired(): void {
  expiryListeners.forEach((listener) => listener())
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: CLIENT_HEADERS,
})

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: CLIENT_HEADERS,
})

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

function isPublicAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
  )
}

async function rotateRefreshToken(): Promise<AuthResponse | null> {
  const refreshToken = await getStoredRefreshToken()
  if (!refreshToken) {
    setAccessToken(null)
    return null
  }

  try {
    const response = await refreshClient.post<AuthResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    })
    const nextRefreshToken = response.data.refresh_token
    if (!nextRefreshToken) {
      await clearStoredRefreshToken()
      setAccessToken(null)
      return null
    }
    await storeRefreshToken(nextRefreshToken)
    setAccessToken(response.data.access_token)
    return response.data
  } catch {
    await clearStoredRefreshToken()
    setAccessToken(null)
    return null
  }
}

export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshPromise) {
    refreshPromise = rotateRefreshToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function clearLocalSession(): Promise<void> {
  setAccessToken(null)
  await clearStoredRefreshToken()
}

export async function startSession(response: AuthResponse): Promise<void> {
  if (response.refresh_token) {
    await storeRefreshToken(response.refresh_token)
  }
  setAccessToken(response.access_token)
}

/**
 * The device has been signed out locally, but the backend could not confirm
 * that the server-side session was revoked. Local credentials are still
 * cleared; callers must tell the user that the server session may persist.
 */
export class LogoutServerError extends Error {
  constructor() {
    super('The server could not confirm that the session was revoked.')
    this.name = 'LogoutServerError'
  }
}

export async function finishSession(): Promise<void> {
  const refreshToken = await getStoredRefreshToken()
  let serverRevoked = false
  try {
    await api.post('/auth/logout', { refresh_token: refreshToken ?? undefined })
    serverRevoked = true
  } catch {
    // Device credentials are cleared below even when the server is
    // unreachable, so the refresh token cannot keep being used here.
    serverRevoked = false
  }

  await clearLocalSession()
  notifySessionExpired()

  if (!serverRevoked) {
    throw new LogoutServerError()
  }
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
      !isPublicAuthEndpoint(original.url)
    ) {
      original._retry = true
      const refreshed = await refreshSession()
      if (refreshed) {
        original.headers.Authorization = `Bearer ${refreshed.access_token}`
        return api(original)
      }
      notifySessionExpired()
    }

    return Promise.reject(error)
  },
)
