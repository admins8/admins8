import { describe, expect, it, vi } from 'vitest'
import {
  isDynamicImportLoadError,
  recoverFromDynamicImportLoadError,
} from './chunkErrorRecovery'

describe('isDynamicImportLoadError', () => {
  it('识别 Vite 动态分包加载失败错误', () => {
    expect(isDynamicImportLoadError(new TypeError('Failed to fetch dynamically imported module'))).toBe(true)
    expect(isDynamicImportLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isDynamicImportLoadError(new Error('Loading chunk 123 failed.'))).toBe(true)
  })

  it('不把普通路由错误当成分包加载失败', () => {
    expect(isDynamicImportLoadError(new Error('Permission denied'))).toBe(false)
  })
})

describe('recoverFromDynamicImportLoadError', () => {
  it('首次遇到分包加载失败时标记并刷新页面', () => {
    const storage = new Map<string, string>()
    const reload = vi.fn()

    const recovered = recoverFromDynamicImportLoadError(
      new Error('Failed to fetch dynamically imported module'),
      {
        getItem: (key) => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
      { reload },
    )

    expect(recovered).toBe(true)
    expect(storage.get('legado-router-chunk-reload')).toBe('1')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('已经刷新过一次后不再重复刷新，避免死循环', () => {
    const reload = vi.fn()

    const recovered = recoverFromDynamicImportLoadError(
      new Error('Loading chunk 123 failed.'),
      {
        getItem: () => '1',
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      { reload },
    )

    expect(recovered).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
