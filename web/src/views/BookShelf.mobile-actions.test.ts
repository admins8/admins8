import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(currentDir, 'BookShelf.vue'), 'utf-8')

describe('手机版我的书架入口显示', () => {
  it('手机和平板隐藏书架侧栏，避免出现重复的全部书籍入口', () => {
    expect(source).toContain('class="mobile-hidden-shelf-entry"')
    expect(source).toContain('class="sidebar-btn mobile-hidden-shelf-entry"')
    expect(source).toContain('.mobile-hidden-empty-search')
    expect(source).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.shelf-sidebar\s*\{[^}]*display:\s*none;/)
  })
})
