import { describe, expect, it, vi } from 'vitest'
import { isAdminRouteMenuIndex, navigateAdminMenu } from './adminMenuNavigation'

describe('isAdminRouteMenuIndex', () => {
  it('只把后台路由菜单项识别为可跳转菜单', () => {
    expect(isAdminRouteMenuIndex('/admin/dashboard')).toBe(true)
    expect(isAdminRouteMenuIndex('/admin/sources/schedule')).toBe(true)
    expect(isAdminRouteMenuIndex('content')).toBe(false)
    expect(isAdminRouteMenuIndex('source-manage')).toBe(false)
  })
})

describe('navigateAdminMenu', () => {
  it('点击不同菜单时显式调用 router.push 更新右侧内容', async () => {
    const push = vi.fn().mockResolvedValue(undefined)

    await navigateAdminMenu('/admin/users', '/admin/dashboard', { push })

    expect(push).toHaveBeenCalledWith('/admin/users')
  })

  it('重复点击当前菜单不触发跳转', async () => {
    const push = vi.fn().mockResolvedValue(undefined)

    await navigateAdminMenu('/admin/users', '/admin/users', { push })

    expect(push).not.toHaveBeenCalled()
  })

  it('点击分组菜单不触发跳转', async () => {
    const push = vi.fn().mockResolvedValue(undefined)

    await navigateAdminMenu('source-manage', '/admin/users', { push })

    expect(push).not.toHaveBeenCalled()
  })
})
