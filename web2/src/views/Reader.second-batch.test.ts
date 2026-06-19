import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(currentDir, 'Reader.vue'), 'utf-8')

describe('阅读器第二批增强', () => {
  it('支持滚动和分页两种阅读模式，以及按视口高度翻页', () => {
    expect(source).toContain("type ReadingMode = 'scroll' | 'pagination'")
    expect(source).toContain("type PageAnimation = 'none' | 'slide' | 'simulation'")
    expect(source).toContain('readingMode')
    expect(source).toContain('pageAnimation')
    expect(source).toContain('goNextPage')
    expect(source).toContain('goPrevPage')
    expect(source).toContain('clientHeight')
  })

  it('支持左右滑动翻页和滚动到底自动下一章', () => {
    expect(source).toContain('handleTouchStart')
    expect(source).toContain('handleTouchEnd')
    expect(source).toContain('touchStartX')
    expect(source).toContain('autoNextChapterOnScroll')
    expect(source).toContain('handleReaderScroll')
    expect(source).toContain('滚动到底自动下一章')
  })

  it('支持正文搜索、自动翻页和更完整的听书控制入口', () => {
    expect(source).toContain('showSearch')
    expect(source).toContain('searchKeyword')
    expect(source).toContain('searchMatches')
    expect(source).toContain('goNextSearchResult')
    expect(source).toContain('自动翻页')
    expect(source).toContain('startAutoPage')
    expect(source).toContain('stopAutoPage')
    expect(source).toContain('上一句')
    expect(source).toContain('下一句')
  })
})
