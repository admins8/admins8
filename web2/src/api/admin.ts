import request from './request'
import type { User, AdminStats, Book, BookCategory } from './types'

export interface AdminPlugin {
  id: number
  key: string
  name: string
  description: string
  enabled: boolean
  config: Record<string, any>
}

export interface CollectorRulePayload {
  id?: number
  name: string
  entryUrl: string
  enabled?: boolean
  charset?: string
  headers?: Record<string, string> | string
  detailRules: {
    name: string
    author: string
    coverUrl: string
    intro: string
    tocUrl: string
    kind?: string
    latestChapterTitle?: string
  }
  tocRules: {
    chapterList: string
    chapterTitle: string
    chapterUrl: string
  }
  contentRule: string
}

export interface CollectorRuleRow {
  id: number
  name: string
  entryUrl: string
  enabled: boolean
  rule: CollectorRulePayload
  createdAt: string
  updatedAt: string
}

export interface CollectorRunResult {
  book: { name: string; author: string; bookUrl: string; tocUrl: string; originName: string }
  chapterCount: number
  contentCount: number
  imported: boolean
}

export interface CollectorUpdateCheckResult {
  canUpdate: boolean
  localChapterCount: number
  remoteChapterCount: number
  ruleName: string
  message: string
}

export interface CollectorTestResult {
  rule: { name: string; entryUrl: string }
  detail: { ok: boolean; url: string; htmlLength: number; book?: any; error?: string }
  toc: { ok: boolean; url: string; htmlLength: number; chapterCount: number; chapters: any[]; error?: string }
  content: { ok: boolean; url: string; htmlLength: number; length: number; preview?: string; error?: string }
  imported: false
}

export interface CollectorLogRow {
  id: number
  ruleId: number
  status: string
  message: string
  bookName: string
  chapterCount: number
  contentCount: number
  createdAt: string
}

export const adminApi = {
  getStats() {
    return request.get<any, AdminStats>('/admin/stats')
  },
  getUsers(page: number = 1, pageSize: number = 20, keyword?: string) {
    let url = `/admin/users?page=${page}&size=${pageSize}`
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`
    return request.get<any, { list: User[]; total: number }>(url)
  },
  getUserRecords(type: string, params: { page?: number; size?: number; keyword?: string; bookKeyword?: string }) {
    const query = new URLSearchParams()
    query.set('page', String(params.page || 1))
    query.set('size', String(params.size || 20))
    if (params.keyword) query.set('keyword', params.keyword)
    if (params.bookKeyword) query.set('bookKeyword', params.bookKeyword)
    return request.get<any, { list: any[]; total: number; page: number; size: number }>(`/admin/user-records/${encodeURIComponent(type)}?${query.toString()}`)
  },
  createUser(data: { username: string; email: string; password: string; role?: string }) {
    return request.post<any, { id: number; username: string; email: string; role: string }>('/admin/users/create', data)
  },
  updateUserStatus(userId: number, data: { is_active?: boolean; role?: string }) {
    return request.post<any, void>('/admin/users/status', { id: userId, ...data })
  },
  updateUserPermissions(userId: number, permissions: string[]) {
    return request.post<any, { permissions: string[] }>('/admin/users/permissions', { id: userId, permissions })
  },
  updateUserPassword(userId: number, password: string) {
    return request.post<any, void>('/admin/users/password', { id: userId, password })
  },
  deleteUser(userId: number) {
    return request.post<any, void>('/admin/users/delete', { id: userId })
  },
  getAllBooks(page: number = 1, pageSize: number = 20, keyword?: string) {
    let url = `/admin/books?page=${page}&size=${pageSize}`
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`
    return request.get<any, { list: Book[]; total: number }>(url)
  },
  deleteBook(bookUrl: string) {
    return request.post<any, void>('/admin/books/delete', { bookUrl })
  },
  dedupeBooks() {
    return request.post<any, { removed: number; groups: number }>('/admin/books/dedupe')
  },
  getBookCategories() {
    return request.get<any, BookCategory[]>('/admin/book-categories')
  },
  createBookCategory(data: { name: string; sortOrder?: number; isActive?: boolean }) {
    return request.post<any, void>('/admin/book-categories/create', data)
  },
  updateBookCategory(data: { id: number; name: string; sortOrder?: number; isActive?: boolean }) {
    return request.post<any, void>('/admin/book-categories/update', data)
  },
  deleteBookCategory(id: number) {
    return request.post<any, void>('/admin/book-categories/delete', { id })
  },
}

export const pluginApi = {
  async getPlugins() {
    const res = await request.get<any, any>('/admin/plugins')
    return res.data || res
  },
  async updateStatus(key: string, enabled: boolean) {
    const res = await request.post<any, any>('/admin/plugins/status', { key, enabled })
    return res.data || res
  },
}

export const collectorApi = {
  async getRules() {
    const res = await request.get<any, any>('/admin/collector/rules')
    return res.data || res
  },
  async saveRule(rule: CollectorRulePayload) {
    const res = await request.post<any, any>('/admin/collector/rules/save', rule)
    return res.data || res
  },
  async deleteRule(id: number) {
    const res = await request.post<any, any>('/admin/collector/rules/delete', { id })
    return res.data || res
  },
  async runSingle(id: number, options?: { includeContent?: boolean; maxChapters?: number; entryUrl?: string }) {
    const res = await request.post<any, any>('/admin/collector/run-single', { id, ...(options || {}) })
    return res.data || res
  },
  async testRule(id: number, options?: { entryUrl?: string }) {
    const res = await request.post<any, any>('/admin/collector/test-rule', { id, ...(options || {}) })
    return res.data || res
  },
  async importRules(payload: any) {
    const res = await request.post<any, any>('/admin/collector/import', payload)
    return res.data || res
  },
  async exportRules() {
    const res = await request.get<any, any>('/admin/collector/export')
    return res.data || res
  },
  async getLogs() {
    const res = await request.get<any, any>('/admin/collector/logs')
    return res.data || res
  },
}
