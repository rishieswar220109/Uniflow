export type ThemePreference = 'system' | 'light' | 'dark'

export interface UserPreferences {
  currency: string
  timezone: string
  theme: ThemePreference
  email_notifications: boolean
  push_notifications: boolean
  weekly_summary: boolean
  onboarding_completed: boolean
}

export interface User {
  id: string
  full_name: string
  email: string
  is_active: boolean
  created_at: string
  updated_at: string
  preferences: UserPreferences
}

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  refresh_token?: string | null
  user: User
}

export interface RegisterInput {
  full_name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface PreferencesUpdate {
  currency?: string
  timezone?: string
  theme?: ThemePreference
  email_notifications?: boolean
  push_notifications?: boolean
  weekly_summary?: boolean
  onboarding_completed?: boolean
}

export interface ProfileUpdate {
  full_name?: string
  preferences?: PreferencesUpdate
}
