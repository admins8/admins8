import { describe, expect, it } from 'vitest'
import { buildAlternateSourceFromSearchResult, expandSearchResultSources, getCurrentChapterPosition, findSwitchedChapterPosition, getExactMatchSourceBadgeCount, mergeSearchResultLocalPriority } from './book'

describe('buildAlternateSourceFromSearchResult', () => {
  it('复用弹出搜索结果生成换源候选并标记当前源', () => {
    const result = buildAlternateSourceFromSearchResult(
      {
        bookUrl: 'https://new.example/book/1',
        name: '诡秘之主',
        author: '爱潜水的乌贼',
        sourceUrl: 'https://source.example',
        sourceName: '新书源',
        _matchLevel: 'exact',
        _matchScore: 100,
      },
      {
        bookUrl: 'https://old.example/book/1',
        name: '诡秘之主',
        author: '爱潜水的乌贼',
        sourceUrl: 'https://old-source.example',
      }
    )

    expect(result?.bookUrl).toBe('https://new.example/book/1')
    expect(result?.sourceUrl).toBe('https://source.example')
    expect(result?.sourceName).toBe('新书源')
    expect(result?.isCurrentSource).toBe(false)
    expect(result?.matchScore).toBe(100)
  })

  it('过滤书名不匹配的搜索结果', () => {
    const result = buildAlternateSourceFromSearchResult(
      { bookUrl: 'https://new.example/book/2', name: '斗破苍穹', author: '天蚕土豆' },
      { bookUrl: 'https://old.example/book/1', name: '诡秘之主', author: '爱潜水的乌贼' }
    )

    expect(result).toBeNull()
  })

  it('过滤非精准匹配的弹出搜索结果', () => {
    const result = buildAlternateSourceFromSearchResult(
      {
        bookUrl: 'https://new.example/book/3',
        name: '诡秘之主番外',
        author: '爱潜水的乌贼',
        sourceUrl: 'https://source.example',
        sourceName: '相关书源',
        _matchLevel: 'related',
        _matchScore: 60,
      },
      {
        bookUrl: 'https://old.example/book/1',
        name: '诡秘之主',
        author: '爱潜水的乌贼',
        sourceUrl: 'https://old-source.example',
      }
    )

    expect(result).toBeNull()
  })

  it('过滤书名不是完全相同的搜索结果', () => {
    const result = buildAlternateSourceFromSearchResult(
      {
        bookUrl: 'https://new.example/book/4',
        name: '诡秘之主番外',
        author: '爱潜水的乌贼',
        sourceUrl: 'https://source.example',
        sourceName: '相近书名',
        _matchLevel: 'exact',
        _matchScore: 100,
      },
      {
        bookUrl: 'https://old.example/book/1',
        name: '诡秘之主',
        author: '爱潜水的乌贼',
        sourceUrl: 'https://old-source.example',
      }
    )

    expect(result).toBeNull()
  })

  it('过滤作者缺失的搜索结果', () => {
    const result = buildAlternateSourceFromSearchResult(
      {
        bookUrl: 'https://new.example/book/5',
        name: '诡秘之主',
        author: '',
        sourceUrl: 'https://source.example',
        sourceName: '缺作者书源',
        _matchLevel: 'exact',
        _matchScore: 100,
      },
      {
        bookUrl: 'https://old.example/book/1',
        name: '诡秘之主',
        author: '爱潜水的乌贼',
        sourceUrl: 'https://old-source.example',
      }
    )

    expect(result).toBeNull()
  })

  it('允许作者包含关系但匹配分低于完全相同', () => {
    const result = buildAlternateSourceFromSearchResult(
      {
        bookUrl: 'https://new.example/book/6',
        name: '诡秘之主',
        author: '作者：爱潜水的乌贼 著',
        sourceUrl: 'https://source.example',
        sourceName: '作者带前后缀书源',
        _matchScore: 100,
      },
      {
        bookUrl: 'https://old.example/book/1',
        name: '诡秘之主',
        author: '爱潜水的乌贼',
        sourceUrl: 'https://old-source.example',
      }
    )

    expect(result?.bookUrl).toBe('https://new.example/book/6')
    expect(result?.matchScore).toBeLessThan(100)
  })

  it('过滤非包含关系的不同作者', () => {
    const result = buildAlternateSourceFromSearchResult(
      {
        bookUrl: 'https://new.example/book/7',
        name: '诡秘之主',
        author: '天蚕土豆',
        sourceUrl: 'https://source.example',
        sourceName: '不同作者书源',
      },
      {
        bookUrl: 'https://old.example/book/1',
        name: '诡秘之主',
        author: '爱潜水的乌贼',
        sourceUrl: 'https://old-source.example',
      }
    )

    expect(result).toBeNull()
  })
})

describe('expandSearchResultSources', () => {
  it('聚合搜索结果会展开为多个可换源候选', () => {
    const sources = expandSearchResultSources({
      bookUrl: 'https://a/book',
      name: '斗破苍穹',
      author: '天蚕土豆',
      sourceUrl: 'https://a',
      sourceName: 'A源',
      sources: [
        { bookUrl: 'https://a/book', sourceUrl: 'https://a', sourceName: 'A源' },
        { bookUrl: 'https://b/book', sourceUrl: 'https://b', sourceName: 'B源' },
      ],
    } as any)

    expect(sources).toHaveLength(2)
    expect(sources[0].sourceName).toBe('A源')
    expect(sources[1].bookUrl).toBe('https://b/book')
    expect(sources[1].name).toBe('斗破苍穹')
    expect(sources[1].author).toBe('天蚕土豆')
  })
})

describe('mergeSearchResultLocalPriority', () => {
  it('同一本书后续聚合结果到达时保留本地采集源为默认入口', () => {
    const local = {
      bookUrl: 'https://local/book',
      name: '全职法师',
      author: '乱',
      sourceUrl: 'https://local-source',
      sourceName: '本地采集',
      _local: true,
      _readable: true,
      _tocVerified: true,
      sourceCount: 1,
      sources: [{ bookUrl: 'https://local/book', sourceUrl: 'https://local-source', sourceName: '本地采集', _local: true }],
    } as any
    const cached = {
      bookUrl: 'https://remote/book',
      name: '全职法师',
      author: '乱',
      sourceUrl: 'https://remote-source',
      sourceName: '网络源',
      sourceCount: 24,
      sources: [{ bookUrl: 'https://remote/book', sourceUrl: 'https://remote-source', sourceName: '网络源' }],
    } as any

    const merged = mergeSearchResultLocalPriority(local, cached)

    expect(merged.bookUrl).toBe('https://local/book')
    expect(merged._local).toBe(true)
    expect(merged.sources?.[0].bookUrl).toBe('https://local/book')
    expect(merged.sourceCount).toBe(2)
  })
})

describe('getExactMatchSourceBadgeCount', () => {
  it('精确匹配且来源数大于 1 时显示来源数量', () => {
    expect(getExactMatchSourceBadgeCount({ _matchLevel: 'exact', sourceCount: 10 } as any)).toBe(10)
  })

  it('非精确匹配或来源数为 1 时不显示', () => {
    expect(getExactMatchSourceBadgeCount({ _matchLevel: 'related', sourceCount: 10 } as any)).toBe(0)
    expect(getExactMatchSourceBadgeCount({ _matchLevel: 'exact', sourceCount: 1 } as any)).toBe(0)
  })
})

describe('getCurrentChapterPosition', () => {
  const chapters = [
    { title: '第一章', url: '/c1.html', index: 10 },
    { title: '第二章', url: '/c2.html', index: 20 },
    { title: '第三章', url: '/c3.html', index: 30 },
  ]

  it('优先按章节 URL 定位目录位置', () => {
    expect(getCurrentChapterPosition(chapters, { title: '第二章', url: '/c2.html', index: 999 })).toBe(1)
  })

  it('没有 URL 时按章节 index 定位目录位置', () => {
    expect(getCurrentChapterPosition(chapters, { title: '第二章', url: '', index: 20 })).toBe(1)
  })

  it('无法定位时返回 0', () => {
    expect(getCurrentChapterPosition(chapters, { title: '未知', url: '/none.html', index: 999 })).toBe(0)
  })
})

describe('findSwitchedChapterPosition', () => {
  const oldChapters = [
    { title: '第一章 陨落的天才', url: '/old/1.html', index: 0 },
    { title: '第二章 斗之气三段', url: '/old/2.html', index: 1 },
    { title: '第三章 客人', url: '/old/3.html', index: 2 },
  ]

  it('换源后优先按章节标题相似度定位', () => {
    const newChapters = [
      { title: '楔子', url: '/new/0.html', index: 0 },
      { title: '第1章 陨落的天才', url: '/new/1.html', index: 1 },
      { title: '第2章 斗之气三段', url: '/new/2.html', index: 2 },
    ]

    expect(findSwitchedChapterPosition(oldChapters, oldChapters[0], newChapters)).toBe(1)
  })

  it('标题差异较大时按章节数字定位', () => {
    const newChapters = [
      { title: '第一章 前言', url: '/new/1.html', index: 0 },
      { title: '第二章 完全不同标题', url: '/new/2.html', index: 1 },
      { title: '第三章 其它', url: '/new/3.html', index: 2 },
    ]

    expect(findSwitchedChapterPosition(oldChapters, oldChapters[1], newChapters)).toBe(1)
  })

  it('无法匹配标题和章节号时按原目录位置兜底', () => {
    const newChapters = [
      { title: '序', url: '/new/a.html', index: 0 },
      { title: '正文开始', url: '/new/b.html', index: 1 },
      { title: '尾声', url: '/new/c.html', index: 2 },
    ]

    expect(findSwitchedChapterPosition(oldChapters, oldChapters[2], newChapters)).toBe(2)
  })
})
