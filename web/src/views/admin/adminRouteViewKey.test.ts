import { describe, expect, it } from 'vitest'
import { buildAdminRouteViewKey } from './adminRouteViewKey'

describe('buildAdminRouteViewKey', () => {
  it('用户记录二级菜单使用完整路径作为右侧内容 key，确保切换时重新渲染', () => {
    expect(buildAdminRouteViewKey('/admin/user-records/reading')).toBe('/admin/user-records/reading')
    expect(buildAdminRouteViewKey('/admin/user-records/searches')).toBe('/admin/user-records/searches')
  })

  it('不同查询条件也保留在 key 中，避免复用旧内容', () => {
    expect(buildAdminRouteViewKey('/admin/users?page=1')).toBe('/admin/users?page=1')
  })
})
