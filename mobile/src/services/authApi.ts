import { api } from './apiClient'
import type { AuthResponse, LoginInput, RegisterInput, User } from './types'

export const authApi = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', input)
    return data
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', input)
    return data
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>('/auth/me')
    return data
  },
}
