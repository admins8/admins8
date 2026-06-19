import { describe, expect, it, vi } from 'vitest'
import {
  buildCacheRefreshUrl,
  clearAdminRuntimeCache,
} from './adminCacheCleaner'

function createStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
    snapshot: () => Object.fromEntries(data),
  }
}

describe('buildCacheRefreshUrl', () => {
  it('给当前地址追加缓存清理时间戳，并替换旧时间戳', () => {
    const url = buildCacheRefreshUrl('https://so.soumal.com/admin/users?__cache_clear=1&page=2', 1780000000000)

    expect(url).toBe('https://so.soumal.com/admin/users?page=2&__cache_clear=1780000000000')
  })
})

describe('clearAdminRuntimeCache', () => {
  it('清理会话缓存和浏览器 Cache API，但保留登录 token', async () => {
    const local = createStorage({ token: 'admin-token', theme: 'dark' })
    const session = createStorage({ 'legado-router-chunk-reload': '1', book: 'cached' })
    const deleteCache = vi.fn().mockResolvedValue(true)
    const assign = vi.fn()

    const result = await clearAdminRuntimeCache({
      localStorage: local,
      sessionStorage: session,
      caches: {
        keys: async () => ['vite-cache', 'image-cache'],
        delete: deleteCache,
      },
      location: {
        href: 'https://so.soumal.com/admin/dashboard',
        assign,
      },
      now: () => 1780000000000,
    })

    expect(result.deletedCacheCount).toBe(2)
    expect(local.snapshot()).toEqual({ token: 'admin-token', theme: 'dark' })
    expect(session.snapshot()).toEqual({})
    expect(assign).toHaveBeenCalledWith('https://so.soumal.com/admin/dashboard?__cache_clear=1780000000000')
  })
})
