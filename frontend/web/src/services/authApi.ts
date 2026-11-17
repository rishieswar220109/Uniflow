import { api } from './apiClient'
import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  User,
} from './types'

export const authApi = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', input)
    return response.data
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', input)
    return response.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async me(): Promise<User> {
    const response = await api.get<User>('/auth/me')
    return response.data
  },
}
