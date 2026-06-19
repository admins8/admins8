import request from './request'
import { API_BASE } from './request'
import type { Book, Chapter, SearchResult, AlternateSource, BookComment, BookSocialStats } from './types'

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
  getChapterList(bookUrl: string, sourceUrl?: string) {
    const query = new URLSearchParams({ bookUrl })
    if (sourceUrl) query.set('sourceUrl', sourceUrl)
    return request.get<any, Chapter[]>(`/book/chapters?${query.toString()}`)
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
}

export { buildSearchBooksSSEUrl } from './types'
