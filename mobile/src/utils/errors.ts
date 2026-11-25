import axios from 'axios'

type ApiErrorBody = {
  detail?: unknown
}

function detailMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined
    if (first && typeof first.msg === 'string' && first.msg.trim()) {
      return first.msg.replace(/^Value error,\s*/i, '')
    }
  }

  return undefined
}

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

    return detailMessage(error.response.data?.detail) ?? fallback
  }

  if (error instanceof Error && error.message) return error.message
  return fallback
}
