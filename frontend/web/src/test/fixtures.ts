import type { AuthResponse, User } from '../services/types'

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    full_name: 'Asha Verma',
    email: 'asha@example.com',
    is_active: true,
    created_at: '2026-01-02T10:00:00Z',
    updated_at: '2026-01-02T10:00:00Z',
    preferences: {
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      theme: 'system',
      email_notifications: true,
      push_notifications: true,
      weekly_summary: false,
      onboarding_completed: false,
      ...overrides.preferences,
    },
    ...overrides,
  }
}

export function makeAuthResponse(
  overrides: Partial<AuthResponse> = {},
): AuthResponse {
  return {
    access_token: 'test-access-token',
    token_type: 'bearer',
    expires_in: 900,
    refresh_token: null,
    user: makeUser(),
    ...overrides,
  }
}
