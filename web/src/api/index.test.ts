import { describe, expect, it } from 'vitest'
import { buildSearchBooksSSEUrl, unwrapResponse } from './index'

describe('unwrapResponse', () => {
  it('returns data for standard ApiResponse objects', () => {
    expect(unwrapResponse({ code: 0, data: { ok: true } })).toEqual({ ok: true })
  })

  it('returns non-standard values unchanged', () => {
    expect(unwrapResponse(['a', 'b'])).toEqual(['a', 'b'])
  })
})

describe('buildSearchBooksSSEUrl', () => {
  it('默认不携带目录校验参数', () => {
    const url = buildSearchBooksSSEUrl('/api', '斗破苍穹', { startIndex: 0, targetCount: 10 })

    expect(url).toBe('/api/book/search?keyword=%E6%96%97%E7%A0%B4%E8%8B%8D%E7%A9%B9&startIndex=0&targetCount=10')
  })

  it('换源搜索携带 mode=switch 但不默认校验目录', () => {
    const url = buildSearchBooksSSEUrl('/api', '斗破苍穹', { startIndex: 20, targetCount: 30, mode: 'switch' })

    expect(url).toBe('/api/book/search?keyword=%E6%96%97%E7%A0%B4%E8%8B%8D%E7%A9%B9&startIndex=20&targetCount=30&mode=switch')
  })
})
