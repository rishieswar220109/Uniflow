import { api } from './apiClient'
import type { PreferencesUpdate, ProfileUpdate, User, UserPreferences } from './types'

export const userApi = {
  async updateProfile(input: ProfileUpdate): Promise<User> {
    const { data } = await api.patch<User>('/users/me', input)
    return data
  },

  async updatePreferences(input: PreferencesUpdate): Promise<UserPreferences> {
    const { data } = await api.patch<UserPreferences>(
      '/users/me/preferences',
      input,
    )
    return data
  },
}
