import { api } from './apiClient'
import type {
  PreferencesUpdate,
  ProfileUpdate,
  User,
  UserPreferences,
} from './types'

export const userApi = {
  async getProfile(): Promise<User> {
    const response = await api.get<User>('/users/me')
    return response.data
  },

  async updateProfile(input: ProfileUpdate): Promise<User> {
    const response = await api.patch<User>('/users/me', input)
    return response.data
  },

  async getPreferences(): Promise<UserPreferences> {
    const response = await api.get<UserPreferences>('/users/me/preferences')
    return response.data
  },

  async updatePreferences(
    input: PreferencesUpdate,
  ): Promise<UserPreferences> {
    const response = await api.patch<UserPreferences>(
      '/users/me/preferences',
      input,
    )
    return response.data
  },
}
