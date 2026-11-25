import axios from 'axios'

type ApiErrorBody = {
  detail?: unknown
  code?: unknown
}

/**
 * Convert any thrown value into a short, user-safe message. Internal server
 * details and response payloads are never surfaced verbatim.
 */
export function extractApiError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return 'Unable to reach the server. Check your connection and try again.'
    }

    if (error.response.status >= 500) {
      return 'The service is temporarily unavailable. Please try again shortly.'
    }

    if (error.response.status === 429) {
      return 'Too many attempts. Please wait a moment and try again.'
    }

    const detail = error.response.data?.detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }

    return fallback
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
