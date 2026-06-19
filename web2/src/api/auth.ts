import request from './request'
import type { User, LoginParams, RegisterParams } from './types'

export const authApi = {
  login(data: LoginParams) {
    return request.post<any, { token: string; user: User }>('/auth/login', data)
  },
  logout() {
    return request.post<any, void>('/auth/logout')
  },
  register(data: RegisterParams) {
    return request.post<any, { token: string; user: User }>('/auth/register', data)
  },
  getProfile() {
    return request.get<any, User>('/auth/profile')
  },
  updateProfile(data: Partial<User>) {
    return request.put<any, User>('/auth/profile', data)
  },
  changePassword(data: { old_password: string; new_password: string }) {
    return request.post<any, void>('/auth/change-password', data)
  },
  forgotPassword(data: { email: string }) {
    return request.post<any, { email: string; expiresAt: string; expiresInSeconds: number }>('/auth/forgot-password', data)
  },
  resetPassword(data: { email: string; token: string; new_password: string }) {
    return request.post<any, void>('/auth/reset-password', data)
  },
}
