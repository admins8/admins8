import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { bookApi, unwrapResponse, type AlternateSource, type Book, type Chapter, type SearchResult } from '@/api'

// 将后端 snake_case 字段转换为前端 camelCase
function normalizeBook(raw: any): Book {
  if (!raw) return raw
  return {
    ...raw,
    bookUrl: raw.bookUrl || raw.book_url || raw.bookUrl,
    coverUrl: raw.coverUrl || raw.cover_url || raw.coverUrl,
    latestChapter: raw.latestChapter || raw.latest_chapter || raw.latestChapter,
    sourceUrl: raw.sourceUrl || raw.source_url || raw.sourceUrl,
    sourceName: raw.sourceName || raw.source_name || raw.sourceName,
    durChapterIndex: raw.durChapterIndex !== undefined ? raw.durChapterIndex : raw.dur_chapter_index,
    durChapterTitle: raw.durChapterTitle || raw.dur_chapter_title || raw.durChapterTitle,
  } as Book
}

function getShelfBookKey(book: Partial<Book>): string {
  const name = String(book.name || '').trim().toLowerCase().replace(/\s+/g, '')
  const author = String(book.author || '').trim().toLowerCase().replace(/\s+/g, '')
  return name ? `${name}|${author}` : ''
}

function getBookUrlValue(book: Partial<Book> & Record<string, any>): string {
  return String(book.bookUrl || book.book_url || '').trim()
}

function isSameShelfBook(a: Partial<Book> & Record<string, any>, b: Partial<Book> & Record<string, any>): boolean {
  const aUrl = getBookUrlValue(a)
  const bUrl = getBookUrlValue(b)
  if (aUrl && bUrl && aUrl === bUrl) return true

  const aKey = getShelfBookKey(a)
  const bKey = getShelfBookKey(b)
  if (!aKey || !bKey) return false

  const [aName, aAuthor] = aKey.split('|')
  const [bName, bAuthor] = bKey.split('|')
  return aName === bName && (!aAuthor || !bAuthor || aAuthor === bAuthor)
}

// 书名与搜索关键词的相关性校验（前端兜底过滤，避免后端放行的"散字匹配错书）
function isBookNameRelatedToKeyword(bookName: string, keyword: string): boolean {
  const clean = (s: string): string => String(s || '').trim().toLowerCase().replace(/[\s\p{P}]/gu, '')
  const kw = clean(keyword)
  const name = clean(bookName)
  if (!kw || !name) return false
  // 完全相等 / 包含 / 前缀
  if (name === kw || name.includes(kw) || name.startsWith(kw)) return true
  // 反向：关键词包含书名（例如搜"斗破苍穹"，书名是"斗破"）
  if (kw.length > name.length && name.length >= 2 && kw.includes(name)) return true
  // 长关键词：连续子串（≥70%长度）
  if (kw.length >= 4) {
    const minLen = Math.max(2, Math.floor(kw.length * 0.7))
    for (let i = 0; i <= kw.length - minLen; i++) {
      if (name.includes(kw.slice(i, i + minLen))) return true
    }
  }
  return false
}

function normalizeText(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '')
}

function normalizeSearchKeyText(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[\s\p{P}]/gu, '')
}

function normalizeAuthorForSwitch(value: unknown): string {
  return normalizeText(value)
    .replace(/^(作者|作\s*者|writer|author)[:：]?/i, '')
    .replace(/(著|作品|大神|大大)$/i, '')
}

function getSwitchAuthorMatchLevel(currentAuthorRaw: unknown, resultAuthorRaw: unknown): 'exact' | 'contains' | 'none' {
  const currentBasic = normalizeText(currentAuthorRaw)
  const resultBasic = normalizeText(resultAuthorRaw)
  if (!currentBasic || !resultBasic) return 'none'
  if (currentBasic === resultBasic) return 'exact'
  const currentClean = normalizeAuthorForSwitch(currentAuthorRaw)
  const resultClean = normalizeAuthorForSwitch(resultAuthorRaw)
  if (!currentClean || !resultClean) return 'none'
  if (currentClean === resultClean) return 'contains'
  if (currentClean.includes(resultClean) || resultClean.includes(currentClean)) return 'contains'
  if (currentBasic.includes(resultBasic) || resultBasic.includes(currentBasic)) return 'contains'
  return 'none'
}

export function buildAlternateSourceFromSearchResult(
  result: SearchResult,
  current: { bookUrl?: string; name?: string; author?: string; sourceUrl?: string }
): AlternateSource | null {
  if (!result?.bookUrl) return null
  const currentName = normalizeText(current.name)
  const resultName = normalizeText(result.name)
  if (!currentName || !resultName || currentName !== resultName) return null
  const authorMatchLevel = getSwitchAuthorMatchLevel(current.author, result.author)
  if (authorMatchLevel === 'none') return null

  const isCurrentSource = Boolean(
    (current.bookUrl && result.bookUrl === current.bookUrl) ||
    (current.sourceUrl && result.sourceUrl && current.sourceUrl === result.sourceUrl)
  )

  return {
    ...result,
    sourceUrl: result.sourceUrl || '',
    sourceName: result.sourceName || '未知书源',
    matchScore: authorMatchLevel === 'exact' ? (result._matchScore || 100) : Math.min(result._matchScore || 85, 89),
    isCurrentSource,
  }
}

export function expandSearchResultSources(result: SearchResult): SearchResult[] {
  if (!Array.isArray(result.sources) || result.sources.length === 0) return [result]
  return result.sources.map(source => ({
    ...result,
    ...source,
    name: result.name,
    author: result.author,
    sources: undefined,
    sourceCount: undefined,
    _aggregateKey: result._aggregateKey,
    _matchLevel: source._matchLevel || result._matchLevel,
    _matchLabel: source._matchLabel || result._matchLabel,
    _matchScore: source._matchScore ?? result._matchScore,
  }))
}

export function getExactMatchSourceBadgeCount(result: SearchResult): number {
  const count = Number(result?.sourceCount || 0)
  return result?._matchLevel === 'exact' && count > 1 ? count : 0
}

function toSearchResultSource(result: SearchResult): any {
  const firstSource = Array.isArray(result.sources) ? result.sources.find((source: any) => source?._local) || result.sources[0] : null
  return {
    bookUrl: result.bookUrl,
    sourceUrl: result.sourceUrl,
    sourceName: result.sourceName,
    coverUrl: result.coverUrl,
    intro: result.intro,
    kind: result.kind,
    latestChapterTitle: result.latestChapterTitle,
    wordCount: result.wordCount,
    type: result.type,
    _local: (result as any)._local || firstSource?._local,
    _tocVerified: (result as any)._tocVerified || firstSource?._tocVerified,
    _readable: (result as any)._readable || firstSource?._readable,
    _matchLevel: result._matchLevel || firstSource?._matchLevel,
    _matchLabel: result._matchLabel || firstSource?._matchLabel,
    _matchScore: result._matchScore ?? firstSource?._matchScore,
  }
}

export function mergeSearchResultLocalPriority(existing: SearchResult, incoming: SearchResult): SearchResult {
  const existingIsLocal = Boolean((existing as any)._local)
  const incomingIsLocal = Boolean((incoming as any)._local)

  const localResult = incomingIsLocal ? incoming : existing
  const otherResult = incomingIsLocal ? existing : incoming
  const localSource = {
    ...toSearchResultSource(localResult),
    _local: true,
    _tocVerified: true,
    _readable: true,
  }
  const otherSources = Array.isArray(otherResult.sources) && otherResult.sources.length > 0
    ? otherResult.sources
    : [toSearchResultSource(otherResult)]
  const sources = [localSource]
  for (const source of otherSources) {
    const duplicated = sources.some(item =>
      String(item.bookUrl || '') === String(source?.bookUrl || '') ||
      (!!item.sourceUrl && item.sourceUrl === source?.sourceUrl)
    )
    if (!duplicated) sources.push(source)
  }

  // 保留更好的匹配级别：exact > related
  const existingMatch = (existing as any)._matchLevel === 'exact' ? 2 : ((existing as any)._matchLevel === 'related' ? 1 : 0)
  const incomingMatch = (incoming as any)._matchLevel === 'exact' ? 2 : ((incoming as any)._matchLevel === 'related' ? 1 : 0)
  const keepExistingMatch = existingMatch > incomingMatch ||
    (existingMatch === incomingMatch && ((existing as any)._matchScore || 0) >= ((incoming as any)._matchScore || 0))
  const bestMatchLevel = keepExistingMatch ? (existing as any)._matchLevel : (incoming as any)._matchLevel
  const bestMatchLabel = keepExistingMatch ? (existing as any)._matchLabel : (incoming as any)._matchLabel
  const bestMatchScore = Math.max((existing as any)._matchScore || 0, (incoming as any)._matchScore || 0)

  return {
    ...otherResult,
    ...localResult,
    bookUrl: localResult.bookUrl,
    sourceUrl: localResult.sourceUrl,
    sourceName: localResult.sourceName,
    coverUrl: localResult.coverUrl || otherResult.coverUrl,
    intro: localResult.intro || otherResult.intro,
    latestChapterTitle: localResult.latestChapterTitle || otherResult.latestChapterTitle,
    kind: localResult.kind || otherResult.kind,
    _local: true,
    _readable: true,
    _tocVerified: true,
    sourceCount: sources.length,
    sources,
    _matchLevel: bestMatchLevel,
    _matchLabel: bestMatchLabel,
    _matchScore: bestMatchScore,
  } as SearchResult
}

function getSearchResultKey(result: SearchResult): string {
  // 后端已按 name|author 聚合，前端只按 name 聚合以避免作者为空/不同的重复
  return normalizeSearchKeyText(result.name) || result.bookUrl
}

function upsertSearchResult(list: SearchResult[], result: SearchResult) {
  const key = getSearchResultKey(result)
  const existingIndex = list.findIndex(item => getSearchResultKey(item) === key)
  if (existingIndex >= 0) {
    list[existingIndex] = mergeSearchResultLocalPriority(list[existingIndex], result)
  } else {
    list.push(result)
  }
  // 不再每次插入都排序，避免列表跳动导致滚动位置重置
  // 排序仅在搜索完成时统一进行
}

function getAlternateSourceKey(source: AlternateSource): string {
  if ((source as any)._local) {
    return `${normalizeSearchKeyText(source.name)}|${normalizeSearchKeyText(source.author)}`
  }
  return `${String(source.bookUrl || '').trim()}|${String(source.sourceUrl || '').trim()}`
}

export function getCurrentChapterPosition(
  chapters: { url?: string; index?: number }[],
  currentChapter?: { url?: string; index?: number } | null
): number {
  if (!Array.isArray(chapters) || chapters.length === 0 || !currentChapter) return 0
  const currentUrl = String(currentChapter.url || '').trim()
  if (currentUrl) {
    const byUrl = chapters.findIndex(chapter => String(chapter.url || '').trim() === currentUrl)
    if (byUrl >= 0) return byUrl
  }
  if (typeof currentChapter.index === 'number') {
    const byIndex = chapters.findIndex(chapter => chapter.index === currentChapter.index)
    if (byIndex >= 0) return byIndex
  }
  return 0
}

function normalizeChapterTitle(title: unknown): string {
  return String(title || '')
    .toLowerCase()
    .replace(/第[0-9零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+[章节篇回集话卷]/g, '')
    .replace(/[0-9零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+[、,，.．:：]/g, '')
    .replace(/[\s\p{P}]/gu, '')
}

function parseChineseNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value)
  const digits: Record<string, number> = {
    零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
    壹: 1, 贰: 2, 肆: 4, 伍: 5, 陆: 6, 柒: 7, 捌: 8, 玖: 9,
  }
  const units: Record<string, number> = { 十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000, 万: 10000 }
  let total = 0
  let section = 0
  let number = 0
  for (const char of value) {
    if (char in digits) {
      number = digits[char]
    } else if (char in units) {
      const unit = units[char]
      if (unit === 10000) {
        section = (section + number) * unit
        total += section
        section = 0
      } else {
        section += (number || 1) * unit
      }
      number = 0
    }
  }
  return total + section + number
}

function getChapterNumber(title: unknown): number {
  const text = String(title || '')
  const match = text.match(/第([0-9零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+)[章节篇回集话卷]/)
    || text.match(/^([0-9零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+)[、,，.．:：]/)
  return match ? parseChineseNumber(match[1]) : -1
}

function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length === 1 || b.length === 1) return a === b ? 1 : 0
  const grams = (value: string) => {
    const map = new Map<string, number>()
    for (let i = 0; i < value.length - 1; i++) {
      const gram = value.slice(i, i + 2)
      map.set(gram, (map.get(gram) || 0) + 1)
    }
    return map
  }
  const aGrams = grams(a)
  const bGrams = grams(b)
  let overlap = 0
  for (const [gram, count] of aGrams) {
    overlap += Math.min(count, bGrams.get(gram) || 0)
  }
  return (2 * overlap) / (Math.max(a.length - 1, 0) + Math.max(b.length - 1, 0))
}

export function findSwitchedChapterPosition(
  oldChapters: { title?: string; url?: string; index?: number }[],
  oldCurrentChapter: { title?: string; url?: string; index?: number } | null | undefined,
  newChapters: { title?: string; url?: string; index?: number }[]
): number {
  if (!Array.isArray(newChapters) || newChapters.length === 0) return 0
  const fallback = Math.min(
    Math.max(getCurrentChapterPosition(oldChapters, oldCurrentChapter), 0),
    newChapters.length - 1
  )
  const oldTitle = normalizeChapterTitle(oldCurrentChapter?.title)
  if (oldTitle) {
    let bestIndex = -1
    let bestScore = 0
    const min = Math.max(0, fallback - 10)
    const max = Math.min(newChapters.length - 1, fallback + 10)
    for (let i = min; i <= max; i++) {
      const score = diceSimilarity(oldTitle, normalizeChapterTitle(newChapters[i]?.title))
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }
    if (bestScore >= 0.72 && bestIndex >= 0) return bestIndex
  }
  const oldNum = getChapterNumber(oldCurrentChapter?.title)
  if (oldNum > 0) {
    const byNumber = newChapters.findIndex(chapter => getChapterNumber(chapter?.title) === oldNum)
    if (byNumber >= 0) return byNumber
  }
  return fallback
}

export const useBookStore = defineStore('book', () => {
  // 状态
  const shelf = ref<Book[]>([])
  const currentBook = ref<Book | null>(null)
  const chapters = ref<Chapter[]>([])
  const currentChapter = ref<{ title: string; content: string; index: number; url?: string } | null>(null)
  const searchResults = ref<SearchResult[]>([])
  const exactSearchResults = computed(() =>
    searchResults.value
      .filter((item) => item._matchLevel === 'exact')
      .flatMap((item) => expandSearchResultSources(item))
      .sort((a, b) => {
        // 已采集（本地缓存）优先
        const localDiff = Number(Boolean((b as any)._local)) - Number(Boolean((a as any)._local))
        if (localDiff !== 0) return localDiff
        // 匹配分数高的优先
        const matchDiff = (b._matchScore || 0) - (a._matchScore || 0)
        if (matchDiff !== 0) return matchDiff
        return 0
      })
  )
  const relatedSearchResults = computed(() =>
    searchResults.value
      .filter((item) => item._matchLevel !== 'exact')
      .flatMap((item) => expandSearchResultSources(item))
      .sort((a, b) => {
        // 已采集（本地缓存）优先
        const localDiff = Number(Boolean((b as any)._local)) - Number(Boolean((a as any)._local))
        if (localDiff !== 0) return localDiff
        // 匹配分数高的优先
        const matchDiff = (b._matchScore || 0) - (a._matchScore || 0)
        if (matchDiff !== 0) return matchDiff
        return 0
      })
  )
  const alternateSources = ref<AlternateSource[]>([])
  const searchProgress = ref<{
    searched: number; total: number; results: number; hasMore?: boolean
  } | null>(null)
  const contentAccessError = ref<{ code?: number; message: string; data?: any } | null>(null)
  const fontSize = ref<number>(16)
  const loading = ref<boolean>(false)

  // 分批搜索状态
  const searchKeyword = ref<string>('')        // 当前关键词
  const nextSearchStart = ref<number>(0)        // 下一批从第几个书源开始
  const hasMoreSources = ref<boolean>(false)    // 是否还有未搜索的书源

  // 当前进行中的搜索流（用于 stop/abort）
  let currentEventSource: EventSource | null = null
  let currentAlternateEventSource: EventSource | null = null

  /** 停止当前搜索流（取消 SSE fetch） */
  function stopSearch() {
    if (currentEventSource) {
      try { (currentEventSource as any).close?.() } catch {}
      currentEventSource = null
    }
    loading.value = false
  }

  /** 重置搜索状态（用于新开关键词搜索） */
  function resetSearch() {
    stopSearch()
    searchResults.value = []
    searchProgress.value = null
    searchKeyword.value = ''
    nextSearchStart.value = 0
    hasMoreSources.value = false
  }

  /** 对搜索结果统一排序 */
  function sortSearchResults() {
    searchResults.value.sort((a, b) => {
      const localDiff = Number(Boolean((b as any)._local)) - Number(Boolean((a as any)._local))
      if (localDiff !== 0) return localDiff
      const matchDiff = (b._matchScore || 0) - (a._matchScore || 0)
      if (matchDiff !== 0) return matchDiff
      return (b.sourceCount || 1) - (a.sourceCount || 1)
    })
  }

  /**
   * 开始新搜索：重置状态，持续搜索直到拿到 targetCount 条有效结果
   * 可继续通过 continueSearch() 继续搜索更多
   */
  function search(keyword: string, options?: { targetCount?: number }) {
    if (!keyword.trim()) {
      searchResults.value = []
      return
    }
    if (loading.value) return
    resetSearch()
    searchKeyword.value = keyword
    loading.value = true

    const target = options?.targetCount || 10

    currentEventSource = bookApi.searchBooksSSE(
      keyword,
      (book: SearchResult) => {
        // 前端兜底：书名必须与关键词有某种连续子串关系，否则跳过
        if (!isBookNameRelatedToKeyword(book?.name || '', keyword)) return
        upsertSearchResult(searchResults.value, book)
      },
      (info: any) => {
        searchProgress.value = info
      },
      (doneInfo: any) => {
        // 使用服务端返回的实际搜索到的位置作为"继续搜索"的起点
        nextSearchStart.value = doneInfo.searched || doneInfo.total || nextSearchStart.value
        hasMoreSources.value = !!doneInfo.hasMore
        loading.value = false
        sortSearchResults()
        if (currentEventSource) {
          try { (currentEventSource as any).close?.() } catch {}
          currentEventSource = null
        }
      },
      (msg: string) => {
        console.error('搜索失败', msg)
        loading.value = false
        sortSearchResults()
        if (currentEventSource) {
          try { (currentEventSource as any).close?.() } catch {}
          currentEventSource = null
        }
      },
      { startIndex: 0, targetCount: target }
    )
  }

  /**
   * 继续搜索：从上次搜索到的位置继续，直到再拿 targetCount 条
   */
  function continueSearch(options?: { targetCount?: number }) {
    if (!searchKeyword.value.trim()) return
    if (loading.value) return
    if (!hasMoreSources.value) return

    loading.value = true
    const startIdx = nextSearchStart.value
    const target = options?.targetCount || 10

    currentEventSource = bookApi.searchBooksSSE(
      searchKeyword.value,
      (book: SearchResult) => {
        if (!isBookNameRelatedToKeyword(book?.name || '', searchKeyword.value)) return
        upsertSearchResult(searchResults.value, book)
      },
      (info: any) => {
        searchProgress.value = info
      },
      (doneInfo: any) => {
        nextSearchStart.value = doneInfo.searched || doneInfo.total || nextSearchStart.value
        hasMoreSources.value = !!doneInfo.hasMore
        loading.value = false
        // 搜索完成后统一排序
        sortSearchResults()
        if (currentEventSource) {
          try { (currentEventSource as any).close?.() } catch {}
          currentEventSource = null
        }
      },
      (msg: string) => {
        console.error('继续搜索失败', msg)
        loading.value = false
        sortSearchResults()
        if (currentEventSource) {
          try { (currentEventSource as any).close?.() } catch {}
          currentEventSource = null
        }
      },
      { startIndex: startIdx, targetCount: target }
    )
  }

  /** 加载书架 */
  async function loadShelf() {
    try {
      const books = unwrapResponse<Book[]>(await bookApi.getBookshelf()) || []
      shelf.value = books.map(normalizeBook)
    } catch (e) {
      console.error('加载书架失败', e)
    }
  }

  /** 添加书籍到书架 */
  async function addBook(bookUrl: string, sourceUrl?: string, bookData?: any) {
    const book = normalizeBook(
      unwrapResponse<Book>(await bookApi.addBook({ bookUrl, sourceUrl, origin: sourceUrl, ...bookData }))
    )
    const key = getShelfBookKey(book)
    const exists = key && shelf.value.some(item => getShelfBookKey(item) === key)
    if (!exists) {
      shelf.value.unshift(book)
    }
    return book
  }

  function isInShelf(book: Partial<Book> & Record<string, any>): boolean {
    return shelf.value.some(item => isSameShelfBook(item as any, book))
  }

  /** 从书架移除书籍 */
  async function removeBook(bookUrl: string) {
    await bookApi.removeBook(bookUrl)
    shelf.value = shelf.value.filter((b) => b.bookUrl !== bookUrl)
  }

  /** 加载章节列表 */
  async function loadChapters(bookUrl: string, sourceUrl?: string) {
    loading.value = true
    try {
      const data = unwrapResponse<Chapter[]>(await bookApi.getChapterList(bookUrl, sourceUrl)) || []
      // 兼容后端返回的 snake_case 字段名
      const seen = new Set<string>()
      chapters.value = data
        .map((ch: any) => ({
          url: String(ch.url || '').trim(),
          title: String(ch.title || '').trim(),
          index: ch.chapter_index ?? ch.index ?? 0,
        }))
        .filter((ch) => {
          if (!ch.title || !ch.url) return false
          const key = `${ch.title.toLowerCase()}|${ch.url.toLowerCase()}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map((ch, index) => ({ ...ch, index }))
    } catch (e) {
      console.error('加载章节失败', e)
      chapters.value = []
    } finally {
      loading.value = false
    }
  }

  /** 加载章节内容 */
  async function loadContent(bookUrl: string, chapterUrl: string, sourceUrl?: string) {
    loading.value = true
    contentAccessError.value = null
    try {
      const data = unwrapResponse<{ title: string; content: string; index: number } | string>(
        await bookApi.getBookContent(bookUrl, chapterUrl, sourceUrl || currentBook.value?.sourceUrl)
      )
      // 兼容两种格式：对象 { title, content, index } 或纯文本字符串
      if (typeof data === 'string') {
        currentChapter.value = {
          title: '',
          content: data,
          index: 0,
          url: chapterUrl,
        }
      } else if (data && typeof data === 'object') {
        currentChapter.value = {
          title: data.title || '',
          content: data.content || '',
          index: data.index ?? (data as any).chapter_index ?? 0,
          url: chapterUrl,
        }
      } else {
        currentChapter.value = null
      }
      // 保存阅读进度
      if (currentChapter.value && localStorage.getItem('token')) {
        bookApi.saveProgress({
          bookUrl,
          name: currentBook.value?.name,
          author: currentBook.value?.author,
          coverUrl: currentBook.value?.coverUrl,
          intro: currentBook.value?.intro,
          sourceUrl: currentBook.value?.sourceUrl,
          originName: currentBook.value?.sourceName || currentBook.value?.originName,
          chapterIndex: currentChapter.value.index,
          chapterPos: 0,
          chapterTitle: currentChapter.value.title,
        }).catch(() => {})
      }
    } catch (e: any) {
      console.error('加载内容失败', e)
      currentChapter.value = null
      contentAccessError.value = {
        code: e?.code,
        message: e?.message || '加载章节失败',
        data: e?.data,
      }
    } finally {
      loading.value = false
    }
  }

  /** 加载当前书籍的其它可用书源 */
  async function loadAlternateSources(bookUrl: string, context?: { name?: string; author?: string; sourceUrl?: string; chapterIndex?: number }) {
    const data = unwrapResponse<AlternateSource[]>(await bookApi.getAlternateSources(bookUrl, context)) || []
    alternateSources.value = data
    return data
  }

  /** 流式加载其它可用书源，搜到一个立即回调 */
  function streamAlternateSources(
    bookUrl: string,
    context: { name?: string; author?: string; sourceUrl?: string; chapterIndex?: number; excludeBookUrls?: string[] } | undefined,
    onResult: (source: AlternateSource) => void,
    onProgress: (info: { searched: number; total: number; results: number }) => void,
    onDone: (hasMore: boolean) => void,
    onError: (msg: string) => void
  ) {
    stopAlternateSourceSearch()
    if (!context?.excludeBookUrls?.length) {
      alternateSources.value = []
    }
    const keyword = String(context?.name || currentBook.value?.name || '').trim()
    if (!keyword) {
      onError('缺少书名，无法搜索换源')
      return null as any
    }

    currentAlternateEventSource = bookApi.getAlternateSourcesSSE(
      bookUrl,
      {
        name: keyword,
        author: context?.author || currentBook.value?.author || '',
        sourceUrl: context?.sourceUrl || currentBook.value?.sourceUrl || '',
        chapterIndex: context?.chapterIndex,
        excludeBookUrls: context?.excludeBookUrls,
      },
      (source) => {
        if (!source) return
        if (!alternateSources.value.some(item => getAlternateSourceKey(item) === getAlternateSourceKey(source))) {
          alternateSources.value.push(source)
          alternateSources.value.sort((a, b) => {
            const localDiff = Number(Boolean((b as any)._local)) - Number(Boolean((a as any)._local))
            if (localDiff !== 0) return localDiff
            if (a.isCurrentSource !== b.isCurrentSource) return a.isCurrentSource ? -1 : 1
            return (b.matchScore || 0) - (a.matchScore || 0)
          })
          onResult(source)
        }
      },
      onProgress,
      (doneInfo) => {
        currentAlternateEventSource = null
        onDone(doneInfo?.hasMore || false)
      },
      (msg) => {
        currentAlternateEventSource = null
        onError(msg)
      },
    )
    return currentAlternateEventSource
  }

  function stopAlternateSourceSearch() {
    if (currentAlternateEventSource) {
      try { (currentAlternateEventSource as any).close?.() } catch {}
      currentAlternateEventSource = null
    }
  }

  /** 切换书源 */
  async function switchSource(oldBookUrl: string, newBook: AlternateSource, chapterIndex?: number) {
    const data = unwrapResponse<{ bookUrl: string }>(await bookApi.switchSource(oldBookUrl, newBook, chapterIndex))
    const newBookUrl = data.bookUrl || newBook.bookUrl
    shelf.value = shelf.value.map(book => {
      if (book.bookUrl !== oldBookUrl) return book
      return normalizeBook({
        ...book,
        ...newBook,
        bookUrl: newBookUrl,
        sourceUrl: newBook.sourceUrl,
        originName: newBook.sourceName,
      })
    })
    if (currentBook.value?.bookUrl === oldBookUrl) {
      currentBook.value = normalizeBook({
        ...currentBook.value,
        ...newBook,
        bookUrl: newBookUrl,
        sourceUrl: newBook.sourceUrl,
        originName: newBook.sourceName,
      })
    }
    chapters.value = []
    currentChapter.value = null
    return newBookUrl
  }

  /** 设置字体大小 */
  function setFontSize(size: number) {
    fontSize.value = Math.max(12, Math.min(32, size))
  }

  /** 设置当前书籍 */
  function setCurrentBook(book: Book) {
    currentBook.value = book
  }

  return {
    shelf,
    currentBook,
    chapters,
    currentChapter,
    searchResults,
    exactSearchResults,
    relatedSearchResults,
    alternateSources,
    searchProgress,
    contentAccessError,
    fontSize,
    loading,
    // 分批搜索状态
    searchKeyword,
    nextSearchStart,
    hasMoreSources,
    // 方法
    loadShelf,
    search,
    continueSearch,
    stopSearch,
    resetSearch,
    addBook,
    isInShelf,
    removeBook,
    loadChapters,
    loadContent,
    loadAlternateSources,
    streamAlternateSources,
    stopAlternateSourceSearch,
    switchSource,
    setFontSize,
    setCurrentBook,
  }
})
