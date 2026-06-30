import request from './request'
import { API_BASE } from './request'
import type { Book, Chapter, SearchResult, AlternateSource, BookComment, BookSocialStats } from './types'
import { buildSearchBooksSSEUrl } from './types'

// ========== 采集更新相关类型 ==========

export interface CollectorUpdateCheckResult {
  canUpdate: boolean
  localChapterCount: number
  remoteChapterCount: number
  message: string
}

export interface CollectorUpdateResult {
  chapterCount: number
  message: string
}

// ========== 书源替换相关类型 ==========

export interface SwitchBookSourceParams {
  keyword?: string
  isReplace?: boolean
}

export const bookApi = {
  getBookshelf() {
    return request.get<any, Book[]>('/book/bookshelf')
  },
  addBook(data: { bookUrl: string; sourceUrl?: string; origin?: string; name?: string; author?: string; coverUrl?: string; intro?: string; sourceName?: string; originName?: string }) {
    return request.post<any, Book>('/book/add', data)
  },
  removeBook(bookUrl: string) {
    return request.post<any, void>('/book/remove', { bookUrl })
  },
  getSocialStats(params: { bookUrl: string; name?: string; author?: string }) {
    const query = new URLSearchParams({ bookUrl: params.bookUrl })
    if (params.name) query.set('name', params.name)
    if (params.author) query.set('author', params.author)
    return request.get<any, BookSocialStats>(`/book/social-stats?${query.toString()}`)
  },
  getComments(bookUrl: string) {
    return request.get<any, BookComment[]>(`/book/comments?bookUrl=${encodeURIComponent(bookUrl)}`)
  },
  addComment(data: { bookUrl: string; content: string }) {
    return request.post<any, BookComment>('/book/comments', data)
  },
  deleteComment(id: number) {
    return request.post<any, void>('/book/comments/delete', { id })
  },
  toggleLike(bookUrl: string) {
    return request.post<any, { liked: boolean }>('/book/like-toggle', { bookUrl })
  },
  toggleAuthorFollow(authorName: string) {
    return request.post<any, { followed: boolean }>('/book/author-follow-toggle', { authorName })
  },
  getAuthorFollowStatus(authorName: string) {
    return request.get<any, { followed: boolean; followerCount: number }>('/book/author-follow-status', { authorName })
  },
  getMyFollowedAuthors() {
    return request.get<any, { name: string; followedAt: string; followerCount: number }[]>('/book/my-followed-authors')
  },
  getChapterList(bookUrl: string, sourceUrl?: string, autoSync?: boolean) {
    const query = new URLSearchParams({ bookUrl })
    if (sourceUrl) query.set('sourceUrl', sourceUrl)
    if (autoSync) query.set('autoSync', 'true')
    return request.get<any, Chapter[]>(`/book/chapters?${query.toString()}`)
  },
  /** 通过 bookUrl 获取书籍基本信息（名称、作者、封面、简介等） */
  getBookInfo(bookUrl: string, sourceUrl?: string) {
    const query = new URLSearchParams({ bookUrl })
    if (sourceUrl) query.set('sourceUrl', sourceUrl)
    return request.get<any, { name: string; author: string; coverUrl: string; intro: string; kind: string; latestChapterTitle: string; sourceUrl: string; sourceName: string }>(`/book/info?${query.toString()}`)
  },
  getBookContent(bookUrl: string, chapterUrl: string, sourceUrl?: string) {
    const query = new URLSearchParams({ bookUrl, chapterUrl })
    if (sourceUrl) query.set('sourceUrl', sourceUrl)
    return request.get<any, { title: string; content: string; index: number }>(`/book/content?${query.toString()}`)
  },
  saveProgress(data: { bookUrl: string; name?: string; author?: string; coverUrl?: string; intro?: string; sourceUrl?: string; originName?: string; chapterIndex: number; chapterPos: number; chapterTitle: string }) {
    return request.post<any, void>('/book/progress', data)
  },
  searchBooks(keyword: string) {
    return request.get<any, SearchResult[]>(`/book/search?keyword=${encodeURIComponent(keyword)}`)
  },
  getAlternateSources(bookUrl: string, context?: { name?: string; author?: string; sourceUrl?: string; chapterIndex?: number }) {
    const params = new URLSearchParams({ bookUrl })
    if (context?.name) params.set('name', context.name)
    if (context?.author) params.set('author', context.author)
    if (context?.sourceUrl) params.set('sourceUrl', context.sourceUrl)
    if (context?.chapterIndex != null) params.set('chapterIndex', String(context.chapterIndex))
    return request.get<any, AlternateSource[]>(`/book/alternate-sources?${params.toString()}`)
  },
  switchSource(oldBookUrl: string, newBook: AlternateSource, chapterIndex?: number) {
    return request.post<any, { bookUrl: string }>('/book/switch-source', { oldBookUrl, newBook, chapterIndex })
  },

  // ========== 采集更新接口 ==========

  /** 检查采集书籍是否有章节更新（只检查不更新） */
  checkCollectorUpdate(bookUrl: string) {
    return request.get<any, CollectorUpdateCheckResult>(
      `/book/collector-update-check?bookUrl=${encodeURIComponent(bookUrl)}`
    )
  },

  /** 执行采集书籍更新（自动检查并更新到最新章节） */
  updateCollectorBook(bookUrl: string) {
    return request.post<any, CollectorUpdateResult>('/book/collector-update', { bookUrl })
  },

  searchBooksSSE(
    keyword: string,
    onResult: (book: SearchResult) => void,
    onProgress: (info: any) => void,
    onDone: (info: any) => void,
    onError: (msg: string) => void,
    options?: { startIndex?: number; targetCount?: number; verifyToc?: boolean; mode?: 'normal' | 'switch' }
  ) {
    const url = buildSearchBooksSSEUrl(API_BASE, keyword, options)
    const token = localStorage.getItem('token')
    const headers: Record<string, string> = { 'Accept': 'text/event-stream' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const controller = new AbortController()
    let closed = false

    fetch(url, { headers, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          onError(`请求失败 (${response.status})`)
          return
        }
        const reader = response.body?.getReader()
        if (!reader) { onError('无法读取响应流'); return }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done || closed) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              switch (data.type) {
                case 'result': onResult(data.data); break
                case 'progress': onProgress(data); break
                case 'done': onDone(data); closed = true; break
                case 'error': onError(data.msg || '搜索出错'); closed = true; break
                case 'start': onProgress(data); break
              }
            } catch (e) { /* ignore parse errors */ }
          }
          if (closed) break
        }
      })
      .catch((e) => {
        if (!closed) onError(e.name === 'AbortError' ? '搜索已取消' : '搜索连接失败')
      })

    // 返回一个类 EventSource 对象
    return {
      close: () => { closed = true; controller.abort() },
      readyState: 0,
      url,
    } as any
  },

  getAlternateSourcesSSE(
    bookUrl: string,
    context: { name?: string; author?: string; sourceUrl?: string; chapterIndex?: number; excludeBookUrls?: string[] },
    onResult: (source: AlternateSource) => void,
    onProgress: (info: any) => void,
    onDone: (info: any) => void,
    onError: (msg: string) => void
  ) {
    const params = new URLSearchParams({ bookUrl })
    if (context?.name) params.set('name', context.name)
    if (context?.author) params.set('author', context.author)
    if (context?.sourceUrl) params.set('sourceUrl', context.sourceUrl)
    if (context?.chapterIndex != null) params.set('chapterIndex', String(context.chapterIndex))
    if (context?.excludeBookUrls?.length) params.set('excludeBookUrls', context.excludeBookUrls.join(','))

    const url = `${API_BASE}/book/alternate-sources/stream?${params.toString()}`
    const token = localStorage.getItem('token')
    const headers: Record<string, string> = { 'Accept': 'text/event-stream' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const controller = new AbortController()
    let closed = false

    fetch(url, { headers, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          onError(`请求失败 (${response.status})`)
          return
        }
        const reader = response.body?.getReader()
        if (!reader) { onError('无法读取响应流'); return }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done || closed) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              switch (data.type) {
                case 'result': onResult(data.data); break
                case 'progress': onProgress(data); break
                case 'done': onDone(data); closed = true; break
                case 'error': onError(data.msg || '换源出错'); closed = true; break
                case 'start': onProgress(data); break
              }
            } catch (e) { /* ignore parse errors */ }
          }
          if (closed) break
        }
      })
      .catch((e) => {
        if (!closed) onError(e.name === 'AbortError' ? '换源已取消' : '换源连接失败')
      })

    return {
      close: () => { closed = true; controller.abort() },
      readyState: 0,
      url,
    } as any
  },
}

export { buildSearchBooksSSEUrl } from './types'