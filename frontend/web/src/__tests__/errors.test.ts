import { describe, expect, it } from 'vitest'

import { extractApiError } from '../utils/errors'

function axiosError(status: number, data: unknown) {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, data },
  })
}

describe('API error handling', () => {
  it('returns the backend detail message', () => {
    expect(
      extractApiError(
        axiosError(401, { detail: 'Incorrect email or password' }),
      ),
    ).toBe('Incorrect email or password')
  })

  it('returns a connection message when the request never reached the API', () => {
    const error = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      response: undefined,
    })
    expect(extractApiError(error)).toMatch(/unable to reach the server/i)
  })

  it('hides server internals behind a generic message', () => {
    expect(
      extractApiError(axiosError(500, { detail: 'Traceback leaked here' })),
    ).toMatch(/temporarily unavailable/i)
  })

  it('handles rate limiting', () => {
    expect(extractApiError(axiosError(429, {}))).toMatch(/too many attempts/i)
  })

  it('falls back for unknown values', () => {
    expect(extractApiError(undefined, 'Custom fallback')).toBe('Custom fallback')
  })
})
