import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, unwrapResponse, type User } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const token = ref<string>(localStorage.getItem('token') || '')
  const user = ref<User | null>(null)

  // 计算属性
  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'superadmin')
  const isSuperAdmin = computed(() => user.value?.role === 'superadmin')
  const permissions = computed(() => user.value?.permissions || [])
  const canManageSources = computed(() => isAdmin.value || permissions.value.includes('source_manage'))

  /** 登录 */
  async function login(username: string, password: string) {
    const data = unwrapResponse<{ token: string; user: User }>(
      await authApi.login({ username, password })
    )
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
    return data
  }

  /** 注册 */
  async function register(username: string, email: string, password: string) {
    const data = unwrapResponse<{ token: string; user: User }>(
      await authApi.register({ username, email, password })
    )
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
    return data
  }

  /** 获取用户信息 */
  async function fetchProfile() {
    try {
      user.value = unwrapResponse<User>(await authApi.getProfile())
    } catch {
      clearLocalAuth()
    }
  }

  /** 更新用户信息 */
  async function updateProfile(data: Partial<User>) {
    await authApi.updateProfile(data)
    // 更新成功后重新获取用户信息，确保前端状态同步
    await fetchProfile()
  }

  /** 修改密码 */
  async function changePassword(oldPassword: string, newPassword: string) {
    await authApi.changePassword({ old_password: oldPassword, new_password: newPassword })
  }

  /** 退出登录 */
  function clearLocalAuth() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // 即使服务端清理失败，也清理本地状态
    }
    clearLocalAuth()
  }

  // 初始化时自动获取用户信息
  if (token.value) {
    fetchProfile()
  }

  return {
    token,
    user,
    isLoggedIn,
    isAdmin,
    isSuperAdmin,
    permissions,
    canManageSources,
    login,
    register,
    fetchProfile,
    updateProfile,
    changePassword,
    logout,
    clearLocalAuth,
  }
})
