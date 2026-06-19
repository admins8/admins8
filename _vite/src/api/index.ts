import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { isCapacitor } from '@/utils/platform'

// ==================== Axios 实例 ====================
// force-reload-marker

function getApiBase(): string {
  // Capacitor APP环境：使用完整URL
  if (typeof window !== 'undefined' && isCapacitor()) {
    const stored = localStorage.getItem('API_BASE_URL')
    if (stored) return stored
    return 'https://soumal.com/api'
  }
  // Web环境：使用相对路径（通过Vite代理）
  return '/api'
}

const API_BASE = getApiBase()

const request: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 300000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 自动附加 JWT Token
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 统一错误处理（服务端以 body.code 表示业务状态：0 成功，非 0 失败
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const body = response.data
    // { code, msg, data }
    // 如果是标准 ApiResponse 结构且 code !== 0，则视为业务失败，抛出错误，方便调用方 catch  。
    if (
      body && typeof body === 'object' && 'code' in body) {
      const code = (body as any).code
      if (code === 0) {
        return body
      }
      // 401：未登录，跳转登录页
      if (code === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      // 业务错误：抛出一个带业务 code 和 msg 的错误，catch 侧可以读取 e.message / e.code
      const err: any = new Error((body as any).msg || '请求失败')
      err.code = code
      err.data = (body as any).data
      return Promise.reject(err)
    }
    return body
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 401:
          localStorage.removeItem('token')
          window.location.href = '/login'
          break
        case 403:
          console.error('没有权限访问该资源')
          break
        case 404:
          console.error('请求的资源不存在')
          break
        case 500:
          console.error('服务器内部错误')
          break
        default:
          console.error(data?.msg || data?.message || '请求失败')
      }
      // 补充：若服务端直接返回结构化错误时，尽量把服务端描述抛到 catch 侧。
      const msg = data?.msg || data?.message || '网络请求失败，请稍后重试'
      const err: any = new Error(msg)
      err.code = status
      return Promise.reject(err)
    } else {
      console.error('网络连接失败，请检查网络')
      const err: any = new Error('网络连接失败，请检查网络')
      err.code = 0
      return Promise.reject(err)
    }
  }
)

// ==================== 类型定义 ====================

export interface ApiResponse<T> {
  code: number
  msg?: string
  data: T
}

export type ApiResult<T> = ApiResponse<T> | T

export function unwrapResponse<T>(res: ApiResult<T>): T {
  if (res && typeof res === 'object' && 'code' in res && 'data' in res) {
    return (res as ApiResponse<T>).data
  }
  return res as T
}

export interface User {
  id: string
  username: string
  email: string
  role: 'user' | 'admin' | 'superadmin'
  permissions?: string[]
  avatar?: string
  avatar_url?: string
  createdAt?: string
  created_at?: string
  lastLoginAt?: string
  last_login_at?: string
}

export interface LoginParams {
  username: string
  password: string
}

export interface RegisterParams {
  username: string
  email: string
  password: string
}

export interface Book {
  id: string
  name: string
  author: string
  coverUrl?: string
  intro?: string
  lastChapter?: string
  lastReadTime?: string
  sourceUrl?: string
  bookUrl?: string
  totalChapterNum?: number
  durChapterIndex?: number
  durChapterTitle?: string
  durChapterPos?: number
}

export interface Chapter {
  url: string
  title: string
  index: number
}

export interface BookSource {
  id: string
  bookSourceName: string
  bookSourceUrl: string
  bookSourceGroup?: string
  enabled: boolean
  lastUpdateTime?: number
  weight?: number
  customOrder?: number
}

export interface GenerateSourceParams {
  url: string
  name?: string
  keyword?: string
  mode?: 'html' | 'api'
  headers?: Record<string, string>
}

export interface GenerateSourceResult {
  source: Record<string, any>
  jsonText: string
  diagnostics: string[]
}

export interface SearchResult {
  bookUrl: string
  name: string
  author: string
  coverUrl?: string
  intro?: string
  sourceUrl?: string
  sourceName?: string
  kind?: string
  latestChapterTitle?: string
  wordCount?: string
  type?: number
  _cached?: boolean
  _local?: boolean
  _matchLevel?: 'exact' | 'related' | 'weak' | 'none'
  _matchLabel?: string
  _matchScore?: number
  _aggregateKey?: string
  sourceCount?: number
  sources?: Array<{
    bookUrl: string
    sourceUrl?: string
    sourceName?: string
    coverUrl?: string
    intro?: string
    kind?: string
    latestChapterTitle?: string
    wordCount?: string
    type?: number
    _matchLevel?: 'exact' | 'related' | 'weak' | 'none'
    _matchLabel?: string
    _matchScore?: number
  }>
}

export interface AlternateSource extends SearchResult {
  matchScore?: number
  isCurrentSource?: boolean
}

export function buildSearchBooksSSEUrl(
  apiBase: string,
  keyword: string,
  options?: { startIndex?: number; targetCount?: number; verifyToc?: boolean; mode?: 'normal' | 'switch' }
): string {
  const { startIndex = 0, targetCount = 10, verifyToc = false, mode } = options || {}
  const params = new URLSearchParams({
    keyword,
    startIndex: String(startIndex),
    targetCount: String(targetCount),
  })
  if (verifyToc) params.set('verifyToc', '1')
  if (mode === 'switch') params.set('mode', 'switch')
  return `${apiBase}/book/search?${params.toString()}`
}

export interface AdminStats {
  userCount: number
  bookCount: number
  sourceCount: number
  visitorCount: number
}

export interface BookCategory {
  id: number
  name: string
  sortOrder: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface RankTypeMeta {
  code: string
  label: string
  metricLabel: string
}

export interface RankingItem {
  id: number
  name: string
  author: string
  book_url: string
  cover_url: string
  intro: string
  download_count: number
  rating: number
  sort_order: number
  rank_type: string
  category: string
  review_count: number
  chapter_count: number
  word_count: number
  is_complete: number
  extra: string
}

export interface RankingGroupedResponse {
  meta: RankTypeMeta[]
  categories: string[]
  category: string
  rankings: Record<string, RankingItem[]>
}

export interface LocalLibraryBook {
  id: number
  bookUrl: string
  tocUrl?: string
  origin?: string
  originName?: string
  name: string
  author?: string
  kind?: string
  category?: string
  coverUrl?: string
  intro?: string
  totalChapterNum?: number
  latestChapterTitle?: string
  wordCount?: string
  updatedAt?: string
}

export interface LocalLibraryResponse {
  items: LocalLibraryBook[]
  total: number
  page: number
  pageSize: number
}

export interface SiteConfigItem {
  id: number
  config_key: string
  config_value: string
  description: string
}

export interface BookComment {
  id: number
  userId: number
  username: string
  content: string
  createdAt: string
}

export interface BookSocialStats {
  commentCount: number
  likeCount: number
  favoriteCount: number
  liked: boolean
  favorited: boolean
}

export interface CheckinStatus {
  today: string
  checkedInToday: boolean
  totalDays: number
  totalPoints: number
  pointsEarned?: number
  alreadyChecked?: boolean
}

export interface CheckinMonthRecord {
  checkinDate: string
  points: number
  createdAt?: string
}

export interface CheckinMonth {
  month: string
  start: string
  end: string
  records: CheckinMonthRecord[]
}

// ==================== Auth API ====================

export const authApi = {
  /** 用户登录 */
  login(data: LoginParams) {
    return request.post<any, { token: string; user: User }>('/auth/login', data)
  },

  /** 用户退出 */
  logout() {
    return request.post<any, void>('/auth/logout')
  },

  /** 用户注册 */
  register(data: RegisterParams) {
    return request.post<any, { token: string; user: User }>('/auth/register', data)
  },

  /** 获取当前用户信息 */
  getProfile() {
    return request.get<any, User>('/auth/profile')
  },

  /** 更新用户信息 */
  updateProfile(data: Partial<User>) {
    return request.put<any, User>('/auth/profile', data)
  },

  /** 修改密码（需要当前密码验证） */
  changePassword(data: { old_password: string; new_password: string }) {
    return request.post<any, void>('/auth/change-password', data)
  },

  /** 申请密码重置验证码（输入注册邮箱） */
  forgotPassword(data: { email: string }) {
    return request.post<any, { email: string; expiresAt: string; expiresInSeconds: number }>(
      '/auth/forgot-password',
      data
    )
  },

  /** 重置密码（邮箱 + 验证码 + 新密码） */
  resetPassword(data: { email: string; token: string; new_password: string }) {
    return request.post<any, void>('/auth/reset-password', data)
  },
}

// ==================== Book API ====================

export const bookApi = {
  /** 获取书架 */
  getBookshelf() {
    return request.get<any, Book[]>('/book/bookshelf')
  },

  /** 添加书籍到书架 */
  addBook(data: { bookUrl: string; sourceUrl?: string; origin?: string; name?: string; author?: string; coverUrl?: string; intro?: string; sourceName?: string; originName?: string }) {
    return request.post<any, Book>('/book/add', data)
  },

  /** 从书架移除书籍 */
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

  /** 获取书籍章节列表 */
  getChapterList(bookUrl: string, sourceUrl?: string) {
    const query = new URLSearchParams({ bookUrl })
    if (sourceUrl) query.set('sourceUrl', sourceUrl)
    return request.get<any, Chapter[]>(
      `/book/chapters?${query.toString()}`
    )
  },

  /** 获取章节内容 */
  getBookContent(bookUrl: string, chapterUrl: string, sourceUrl?: string) {
    const query = new URLSearchParams({ bookUrl, chapterUrl })
    if (sourceUrl) query.set('sourceUrl', sourceUrl)
    return request.get<any, { title: string; content: string; index: number }>(
      `/book/content?${query.toString()}`
    )
  },

  async checkCollectorUpdate(bookUrl: string) {
    const res = await request.get<any, ApiResult<CollectorUpdateCheckResult>>(
      `/book/collector-update-check?bookUrl=${encodeURIComponent(bookUrl)}`
    )
    return unwrapResponse(res)
  },

  async updateCollectorBook(bookUrl: string) {
    const res = await request.post<any, ApiResult<CollectorRunResult>>('/book/collector-update', { bookUrl })
    return unwrapResponse(res)
  },

  /** 保存阅读进度 */
  saveProgress(data: {
    bookUrl: string
    name?: string
    author?: string
    coverUrl?: string
    intro?: string
    sourceUrl?: string
    originName?: string
    chapterIndex: number
    chapterPos: number
    chapterTitle: string
  }) {
    return request.post<any, void>('/book/progress', data)
  },

  /** 搜索书籍 */
  searchBooks(keyword: string) {
    return request.get<any, SearchResult[]>(
      `/book/search?keyword=${encodeURIComponent(keyword)}`
    )
  },

  /** 搜索书籍（SSE 流式，搜到一个立即返回一个）
   *  - startIndex: 从第几个书源开始搜索（0-based）
   *  - targetCount: 想要多少条有效结果（默认 10）
   *  - 服务端会持续搜索书源，直到凑够 targetCount 条或搜完全部
   *  - 返回的 done.searched 即下一轮的起点
   */
  searchBooksSSE(
    keyword: string,
    onResult: (book: SearchResult) => void,
    onProgress: (info: { searched: number; total: number; results: number; hasMore?: boolean }) => void,
    onDone: (info: { total: number; searched: number; results: number; hasMore: boolean; batchStart: number; cached: boolean }) => void,
    onError: (msg: string) => void,
    options?: { startIndex?: number; targetCount?: number; verifyToc?: boolean; mode?: 'normal' | 'switch' }
  ): EventSource {
    const token = localStorage.getItem('token') || ''
    // 使用 fetch + ReadableStream 替代 EventSource，支持自定义 Header
    const url = buildSearchBooksSSEUrl(API_BASE, keyword, options)
    const abortController = new AbortController()

    const startFetchSSE = async () => {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        })
        if (!response.ok) {
          onError(`HTTP ${response.status}`)
          return
        }
        const reader = response.body?.getReader()
        if (!reader) {
          onError('无法读取响应流')
          return
        }
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''
          for (const chunk of lines) {
            const dataLine = chunk.split('\n').find(l => l.startsWith('data:'))
            if (!dataLine) continue
            try {
              const msg = JSON.parse(dataLine.slice(5).trim())
              if (msg.type === 'result') onResult(msg.data)
              else if (msg.type === 'progress') onProgress(msg)
              else if (msg.type === 'done') {
                onDone({
                  total: msg.total || 0,
                  searched: msg.searched || msg.total || 0,
                  results: msg.results || 0,
                  hasMore: !!msg.hasMore,
                  batchStart: msg.batchStart ?? startIndex,
                  cached: !!msg.cached,
                })
                return
              }
              else if (msg.type === 'error') { onError(msg.msg); return }
            } catch { /* ignore parse errors */ }
          }
        }
        onDone({ total: 0, searched: 0, results: 0, hasMore: false, batchStart: startIndex, cached: false })
      } catch (err: any) {
        if (err.name !== 'AbortError') onError(err.message || '搜索连接中断')
      }
    }

    startFetchSSE()

    // 返回兼容 EventSource 接口的对象
    return {
      close: () => abortController.abort(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  },

  /** 获取当前书籍的其它可用书源 */
  getAlternateSources(bookUrl: string, context?: { name?: string; author?: string; sourceUrl?: string; chapterIndex?: number }) {
    const params = new URLSearchParams({ bookUrl })
    if (context?.name) params.set('name', context.name)
    if (context?.author) params.set('author', context.author)
    if (context?.sourceUrl) params.set('sourceUrl', context.sourceUrl)
    if (context?.chapterIndex != null) params.set('chapterIndex', String(context.chapterIndex))
    return request.get<any, AlternateSource[]>(
      `/book/alternate-sources?${params.toString()}`
    )
  },

  /** 获取当前书籍的其它可用书源（SSE 流式） */
  getAlternateSourcesSSE(
    bookUrl: string,
    context: { name?: string; author?: string; sourceUrl?: string; chapterIndex?: number } | undefined,
    onResult: (source: AlternateSource) => void,
    onProgress: (info: { searched: number; total: number; results: number }) => void,
    onDone: () => void,
    onError: (msg: string) => void
  ): EventSource {
    const token = localStorage.getItem('token') || ''
    // 使用 fetch + ReadableStream 替代 EventSource，支持自定义 Header
    const params = new URLSearchParams({ bookUrl })
    if (context?.name) params.set('name', context.name)
    if (context?.author) params.set('author', context.author)
    if (context?.sourceUrl) params.set('sourceUrl', context.sourceUrl)
    if (context?.chapterIndex != null) params.set('chapterIndex', String(context.chapterIndex))
    const url = `${API_BASE}/book/alternate-sources/stream?${params.toString()}`
    const abortController = new AbortController()

    const startFetchSSE = async () => {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        })
        if (!response.ok) {
          onError(`HTTP ${response.status}`)
          return
        }
        const reader = response.body?.getReader()
        if (!reader) {
          onError('无法读取响应流')
          return
        }
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''
          for (const chunk of lines) {
            const dataLine = chunk.split('\n').find(l => l.startsWith('data:'))
            if (!dataLine) continue
            try {
              const msg = JSON.parse(dataLine.slice(5).trim())
              if (msg.type === 'result') onResult(msg.data)
              else if (msg.type === 'progress') onProgress(msg)
              else if (msg.type === 'done') { onDone(); return }
              else if (msg.type === 'error') { onError(msg.msg); return }
            } catch { /* ignore parse errors */ }
          }
        }
        onDone()
      } catch (err: any) {
        if (err.name !== 'AbortError') onError(err.message || '换源搜索连接中断')
      }
    }

    startFetchSSE()

    return {
      close: () => abortController.abort(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  },

  /** 切换当前书架书籍到新书源 */
  switchSource(oldBookUrl: string, newBook: AlternateSource, chapterIndex?: number) {
    return request.post<any, { bookUrl: string }>('/book/switch-source', { oldBookUrl, newBook, chapterIndex })
  },
}

// ==================== Source API ====================

export const sourceApi = {
  /** 获取书源列表 */
  getSources() {
    return request.get<any, BookSource[]>('/sources')
  },

  /** 更新书源 */
  updateSource(id: string, data: Partial<BookSource>) {
    return request.put<any, BookSource>(`/sources/${id}`, data)
  },

  /** 删除书源 */
  deleteSources(ids: string[]) {
    return request.post<any, void>('/sources/delete', { ids })
  },

  /** 书源去重 */
  dedupeSources() {
    return request.post<any, { removed: number; ids: number[] }>('/sources/dedupe', {})
  },

  /** 获取书源分组 */
  getSourceGroups() {
    return request.get<any, string[]>('/sources/groups')
  },

  /** 从单个书源或书源集合链接导入书源 */
  importSourcesFromUrl(url: string) {
    return request.post<any, { success: number; fail: number; failedNames?: string[] }>('/sources/import-url', { url })
  },

  /** 单条验证书源 */
  validateSource(id: number, keyword?: string) {
    return request.post<any, ValidateSourceResult>('/sources/validate', { id, keyword })
  },

  getValidationSchedule() {
    return request.get<any, SourceValidationScheduleSettings>('/sources/validation-schedule')
  },

  updateValidationSchedule(data: Partial<SourceValidationScheduleSettings>) {
    return request.put<any, SourceValidationScheduleSettings>('/sources/validation-schedule', data)
  },

  runValidationScheduleNow() {
    return request.post<any, { result: SourceValidationLastResult; settings: SourceValidationScheduleSettings }>('/sources/validation-schedule/run')
  },
}

export interface ValidateSourceResult {
  id: number
  ok: boolean
  sampleCount: number
  respondTime: number
  message: string
}

export interface SourceValidationLastResult {
  total: number
  okCount: number
  failCount: number
  disabledCount: number
  deletedCount: number
  message: string
}

export interface SourceValidationScheduleSettings {
  enabled: boolean
  day: number
  hour: number
  minute: number
  keyword: string
  timeoutMs: number
  concurrency: number
  scope: 'enabled' | 'all' | 'failed'
  failureAction: 'none' | 'disable' | 'delete'
  lastRunKey: string
  lastRunAt: string
  lastResult: SourceValidationLastResult
}

// ==================== Admin API ====================

export const adminApi = {
  /** 获取统计数据 */
  getStats() {
    return request.get<any, AdminStats>('/admin/stats')
  },

  /** 获取用户列表 */
  getUsers(page: number = 1, pageSize: number = 20, keyword?: string) {
    let url = `/admin/users?page=${page}&size=${pageSize}`
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`
    return request.get<any, { list: User[]; total: number }>(url)
  },

  /** 获取用户相关记录 */
  getUserRecords(type: string, params: { page?: number; size?: number; keyword?: string; bookKeyword?: string }) {
    const query = new URLSearchParams()
    query.set('page', String(params.page || 1))
    query.set('size', String(params.size || 20))
    if (params.keyword) query.set('keyword', params.keyword)
    if (params.bookKeyword) query.set('bookKeyword', params.bookKeyword)
    return request.get<any, { list: any[]; total: number; page: number; size: number }>(
      `/admin/user-records/${encodeURIComponent(type)}?${query.toString()}`
    )
  },

  /** 创建用户 */
  createUser(data: { username: string; email: string; password: string; role?: string }) {
    return request.post<any, { id: number; username: string; email: string; role: string }>('/admin/users/create', data)
  },

  /** 更新用户状态 */
  updateUserStatus(userId: number, data: { is_active?: boolean; role?: string }) {
    return request.post<any, void>('/admin/users/status', { id: userId, ...data })
  },

  /** 更新用户功能权限 */
  updateUserPermissions(userId: number, permissions: string[]) {
    return request.post<any, { permissions: string[] }>('/admin/users/permissions', { id: userId, permissions })
  },

  /** 修改用户密码 */
  updateUserPassword(userId: number, password: string) {
    return request.post<any, void>('/admin/users/password', { id: userId, password })
  },

  /** 删除用户 */
  deleteUser(userId: number) {
    return request.post<any, void>('/admin/users/delete', { id: userId })
  },

  /** 获取所有书籍 */
  getAllBooks(page: number = 1, pageSize: number = 20, keyword?: string) {
    let url = `/admin/books?page=${page}&size=${pageSize}`
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`
    return request.get<any, { list: Book[]; total: number }>(url)
  },

  /** 删除书籍 */
  deleteBook(bookUrl: string) {
    return request.post<any, void>('/admin/books/delete', { bookUrl })
  },

  /** 书籍去重（按书名+作者去重，保留最早入库的） */
  dedupeBooks() {
    return request.post<any, { removed: number; groups: number }>('/admin/books/dedupe')
  },

  /** 获取书籍分类 */
  getBookCategories() {
    return request.get<any, BookCategory[]>('/admin/book-categories')
  },

  /** 新增书籍分类 */
  createBookCategory(data: { name: string; sortOrder?: number; isActive?: boolean }) {
    return request.post<any, void>('/admin/book-categories/create', data)
  },

  /** 更新书籍分类 */
  updateBookCategory(data: { id: number; name: string; sortOrder?: number; isActive?: boolean }) {
    return request.post<any, void>('/admin/book-categories/update', data)
  },

  /** 删除书籍分类 */
  deleteBookCategory(id: number) {
    return request.post<any, void>('/admin/book-categories/delete', { id })
  },
}

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
  book: {
    name: string
    author: string
    bookUrl: string
    tocUrl: string
    originName: string
  }
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
  rule: {
    name: string
    entryUrl: string
  }
  detail: {
    ok: boolean
    url: string
    htmlLength: number
    book?: {
      name: string
      author: string
      bookUrl: string
      tocUrl: string
      originName: string
      coverUrl?: string
      intro?: string
      kind?: string
      latestChapterTitle?: string
    }
    error?: string
  }
  toc: {
    ok: boolean
    url: string
    htmlLength: number
    chapterCount: number
    chapters: Array<{
      index: number
      title: string
      url: string
    }>
    error?: string
  }
  content: {
    ok: boolean
    url: string
    htmlLength: number
    length: number
    preview?: string
    error?: string
  }
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

export interface BaiduPushConfig {
  site: string
  token: string
  enabled: boolean
  dailyLimit: number
  maskedToken?: string
}

export interface BaiduPushResult {
  ok: boolean
  status: number
  success: number
  remain: number | null
  error: string
  urlCount: number
  raw: any
}

export interface BaiduPushLogRow {
  id: number
  urlCount: number
  successCount: number
  remainCount: number | null
  status: string
  message: string
  rawJson: string
  createdAt: string
}

export const pluginApi = {
  async getPlugins() {
    const res = await request.get<any, ApiResult<AdminPlugin[]>>('/admin/plugins')
    return unwrapResponse(res)
  },
  async updateStatus(key: string, enabled: boolean) {
    const res = await request.post<any, ApiResult<AdminPlugin>>('/admin/plugins/status', { key, enabled })
    return unwrapResponse(res)
  },
}

export const collectorApi = {
  async getRules() {
    const res = await request.get<any, ApiResult<CollectorRuleRow[]>>('/admin/collector/rules')
    return unwrapResponse(res)
  },
  async saveRule(rule: CollectorRulePayload) {
    const res = await request.post<any, ApiResult<CollectorRuleRow>>('/admin/collector/rules/save', rule)
    return unwrapResponse(res)
  },
  async deleteRule(id: number) {
    const res = await request.post<any, ApiResult<{ ok: boolean }>>('/admin/collector/rules/delete', { id })
    return unwrapResponse(res)
  },
  async runSingle(id: number, options?: { includeContent?: boolean; maxChapters?: number; entryUrl?: string }) {
    const res = await request.post<any, ApiResult<CollectorRunResult>>('/admin/collector/run-single', { id, ...(options || {}) })
    return unwrapResponse(res)
  },
  async testRule(id: number, options?: { entryUrl?: string }) {
    const res = await request.post<any, ApiResult<CollectorTestResult>>('/admin/collector/test-rule', { id, ...(options || {}) })
    return unwrapResponse(res)
  },
  async importRules(payload: any) {
    const res = await request.post<any, ApiResult<{ success: number; fail: number; rules: CollectorRuleRow[]; errors?: string[] }>>('/admin/collector/import', payload)
    return unwrapResponse(res)
  },
  async exportRules() {
    const res = await request.get<any, ApiResult<{ rules: CollectorRulePayload[]; exportedAt: string }>>('/admin/collector/export')
    return unwrapResponse(res)
  },
  async getLogs() {
    const res = await request.get<any, ApiResult<CollectorLogRow[]>>('/admin/collector/logs')
    return unwrapResponse(res)
  },
}

export const baiduPushApi = {
  async getConfig() {
    const res = await request.get<any, ApiResult<BaiduPushConfig>>('/admin/baidu-push/config')
    return unwrapResponse(res)
  },
  async saveConfig(config: BaiduPushConfig) {
    const res = await request.post<any, ApiResult<BaiduPushConfig>>('/admin/baidu-push/config', config)
    return unwrapResponse(res)
  },
  async pushUrls(urls: string[]) {
    const res = await request.post<any, ApiResult<BaiduPushResult>>('/admin/baidu-push/push-urls', { urls })
    return unwrapResponse(res)
  },
  async pushSitemap(limit?: number) {
    const res = await request.post<any, ApiResult<BaiduPushResult>>('/admin/baidu-push/push-sitemap', { limit })
    return unwrapResponse(res)
  },
  async getLogs() {
    const res = await request.get<any, ApiResult<BaiduPushLogRow[]>>('/admin/baidu-push/logs')
    return unwrapResponse(res)
  },
}

export interface RssSource {
  id: number
  source_url: string
  source_name: string
  source_group?: string
  source_icon?: string
  source_comment?: string
  enabled: number | boolean
  custom_order: number
  article_style?: number
  sort_url?: string
}

export interface RssArticle {
  index: number
  title: string
  link: string
  image?: string
  pubDate?: string
}

export const rssSourceApi = {
  getSources() {
    return request.get<any, RssSource[]>('/rss-sources')
  },
  importFromUrl(url: string) {
    return request.post<any, { success: number; fail: number; results: any[] }>('/rss-sources/import-url', { url })
  },
  updateSource(id: number, data: Partial<RssSource>) {
    return request.put<any, void>(`/rss-sources/${id}`, data)
  },
  deleteSources(ids: number[]) {
    return request.post<any, void>('/rss-sources/delete', { ids })
  },
  getArticles(id: number, url?: string) {
    const params = url ? `?url=${encodeURIComponent(url)}` : ''
    return request.get<any, { source: RssSource; items: RssArticle[] }>(`/rss-sources/${id}/articles${params}`)
  },
  getContent(id: number, link: string) {
    return request.get<any, { source: RssSource; link: string; content: string }>(
      `/rss-sources/${id}/content?link=${encodeURIComponent(link)}`
    )
  },
}

export const userApi = {
  getCheckinStatus() {
    return request.get<any, CheckinStatus>('/user/checkin-status')
  },
  getCheckinMonth(month?: string) {
    const query = month ? `?month=${encodeURIComponent(month)}` : ''
    return request.get<any, CheckinMonth>(`/user/checkin-month${query}`)
  },
  checkin() {
    return request.post<any, CheckinStatus>('/user/checkin')
  },
}


// ==================== Update API ====================

export interface UpdateRelease {
  version: string
  publishedAt: string
  url: string
  sigUrl: string
  changelog?: string
  minVersion?: string
}

export interface UpdateCheckResult {
  hasUpdate: boolean
  current: string
  latest?: string
  release?: UpdateRelease
  reason?: string
}

export interface UpdateHistoryRecord {
  id: string
  operator?: string
  success: boolean
  fromVersion: string
  toVersion: string
  backupPath?: string
  error?: string
  rolledBack?: boolean
  startedAt: string
  finishedAt: string
}

export const updateApi = {
  /** 获取当前版本号与升级配置 */
  async getVersion() {
    const res = await request.get<any, ApiResult<{ current: string; manifestUrl: string; online: boolean }>>('/admin/update/version')
    return unwrapResponse(res)
  },
  /** 远端检查是否有新版本 */
  async check() {
    const res = await request.get<any, ApiResult<UpdateCheckResult>>('/admin/update/check')
    return unwrapResponse(res)
  },
  /** 触发后端下载 + 校验 + 解压 */
  async download() {
    const res = await request.post<any, ApiResult<{ version: string; extractDir: string; zipPath: string }>>('/admin/update/download')
    return unwrapResponse(res)
  },
  /** 应用最近一次下载/上传的升级包 */
  async install() {
    const res = await request.post<any, ApiResult<UpdateHistoryRecord>>('/admin/update/install')
    return unwrapResponse(res)
  },
  /** 历史记录 */
  async history() {
    const res = await request.get<any, ApiResult<UpdateHistoryRecord[]>>('/admin/update/history')
    return unwrapResponse(res)
  },
  /** 回滚到指定备份目录 */
  async rollback(backupPath: string) {
    const res = await request.post<any, ApiResult<UpdateHistoryRecord>>('/admin/update/rollback', { backupPath })
    return unwrapResponse(res)
  },
  /** 手动上传 update.zip + 签名 */
  async upload(zipFile: File, signature: File | string) {
    const form = new FormData()
    form.append('package', zipFile)
    if (typeof signature === 'string') {
      form.append('signature', signature)
    } else {
      form.append('signature', signature)
    }
    const res = await request.post<any, ApiResult<{ version: string; extractDir: string }>>('/admin/update/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    })
    return unwrapResponse(res)
  },
}


// ==================== Database API ====================

export interface DatabaseTableInfo {
  name: string
  engine: string
  rows: number
  dataSizeKB: number
  indexSizeKB: number
  totalSizeKB: number
  collation: string | null
  createTime: string | null
  updateTime: string | null
}

export interface DatabaseBackupFile {
  fileName: string
  sizeKB: number
  createdAt: string
}

export interface DatabaseOperateResult {
  table: string
  operation: 'optimize' | 'repair'
  status: 'OK' | 'warning' | 'error'
  message: string
  durationMs: number
}

export const databaseApi = {
  async getTables() {
    const res = await request.get<any, ApiResult<{ totalSizeKB: number; tables: DatabaseTableInfo[] }>>('/admin/database/tables')
    return unwrapResponse(res)
  },
  async backupAll() {
    const res = await request.post<any, ApiResult<{ fileName: string; sizeKB: number; tables: number }>>('/admin/database/backup')
    return unwrapResponse(res)
  },
  async backupTable(table: string) {
    const res = await request.post<any, ApiResult<{ fileName: string; sizeKB: number; rows: number }>>(`/admin/database/backup/${encodeURIComponent(table)}`)
    return unwrapResponse(res)
  },
  async getBackups() {
    const res = await request.get<any, ApiResult<{ totalSizeKB: number; files: DatabaseBackupFile[] }>>('/admin/database/backups')
    return unwrapResponse(res)
  },
  async restore(file: string) {
    const res = await request.post<any, ApiResult<{ success: true; sizeKB: number }>>('/admin/database/restore', { file })
    return unwrapResponse(res)
  },
  async deleteBackup(file: string) {
    const res = await request.post<any, ApiResult<{ file: string }>>('/admin/database/backups/delete', { file })
    return unwrapResponse(res)
  },
  async optimize(tables: string[]) {
    const res = await request.post<any, ApiResult<DatabaseOperateResult[]>>('/admin/database/optimize', { tables })
    return unwrapResponse(res)
  },
  async repair(tables: string[]) {
    const res = await request.post<any, ApiResult<DatabaseOperateResult[]>>('/admin/database/repair', { tables })
    return unwrapResponse(res)
  },
}


// ==================== Page Channel API ====================

export interface PageChannelItem {
  id: number
  section_id: number
  title: string
  author?: string
  cover_url?: string
  intro?: string
  category?: string
  word_count?: string
  latest_chapter?: string
  link_url?: string
  sort_order: number
  is_active: number | boolean
}

export interface PageChannelSection {
  id: number
  channel_code: string
  section_code: string
  title: string
  display_type: string
  more_link?: string
  sort_order: number
  is_active: number | boolean
  items: PageChannelItem[]
}

export interface PageChannel {
  id: number
  code: string
  name: string
  path: string
  compat_path?: string
  seo_title?: string
  seo_keywords?: string
  seo_description?: string
  is_active: number | boolean
  sort_order: number
  sections: PageChannelSection[]
}

export interface ContentPage {
  id?: number
  slug: string
  title: string
  content: string
  seo_title?: string
  seo_keywords?: string
  seo_description?: string
  is_active: number | boolean
  sort_order?: number
}

export interface FriendlyLink {
  id?: number
  name: string
  url: string
  description?: string
  sort_order: number
  is_active: number | boolean
  start_at?: string | null
  end_at?: string | null
}

export const pageApi = {
  async getChannel(code: string) {
    const res = await request.get<any, ApiResult<PageChannel>>(`/pages/channels/${encodeURIComponent(code)}`)
    return unwrapResponse(res)
  },
  async getContentPage(slug: string) {
    const res = await request.get<any, ApiResult<ContentPage>>(`/pages/content/${encodeURIComponent(slug)}`)
    return unwrapResponse(res)
  },
  async getFriendlyLinks() {
    const res = await request.get<any, ApiResult<FriendlyLink[]>>('/pages/friendly-links')
    return unwrapResponse(res)
  },
}

export const pageAdminApi = {
  async getChannel(code: string) {
    const res = await request.get<any, ApiResult<PageChannel | null>>(`/admin/pages/channels/${encodeURIComponent(code)}`)
    return unwrapResponse(res)
  },
  async seedChannel(code: string) {
    const res = await request.post<any, ApiResult<PageChannel>>(`/admin/pages/channels/${encodeURIComponent(code)}/seed`)
    return unwrapResponse(res)
  },
  async updateChannel(code: string, payload: Partial<PageChannel>) {
    const res = await request.put<any, ApiResult<PageChannel>>(`/admin/pages/channels/${encodeURIComponent(code)}`, payload)
    return unwrapResponse(res)
  },
  async createSection(code: string, payload: Partial<PageChannelSection>) {
    const res = await request.post<any, ApiResult<PageChannelSection>>(`/admin/pages/channels/${encodeURIComponent(code)}/sections`, payload)
    return unwrapResponse(res)
  },
  async updateSection(id: number, payload: Partial<PageChannelSection>) {
    const res = await request.put<any, ApiResult<PageChannelSection>>(`/admin/pages/sections/${id}`, payload)
    return unwrapResponse(res)
  },
  async deleteSection(id: number) {
    const res = await request.post<any, ApiResult<{ id: number }>>('/admin/pages/sections/delete', { id })
    return unwrapResponse(res)
  },
  async createItem(sectionId: number, payload: Partial<PageChannelItem>) {
    const res = await request.post<any, ApiResult<PageChannelItem>>(`/admin/pages/sections/${sectionId}/items`, payload)
    return unwrapResponse(res)
  },
  async updateItem(id: number, payload: Partial<PageChannelItem>) {
    const res = await request.put<any, ApiResult<PageChannelItem>>(`/admin/pages/items/${id}`, payload)
    return unwrapResponse(res)
  },
  async deleteItem(id: number) {
    const res = await request.post<any, ApiResult<{ id: number }>>('/admin/pages/items/delete', { id })
    return unwrapResponse(res)
  },
  async listContentPages() {
    const res = await request.get<any, ApiResult<ContentPage[]>>('/admin/pages/content-pages')
    return unwrapResponse(res)
  },
  async getContentPage(slug: string) {
    const res = await request.get<any, ApiResult<ContentPage>>(`/admin/pages/content-pages/${encodeURIComponent(slug)}`)
    return unwrapResponse(res)
  },
  async updateContentPage(slug: string, payload: Partial<ContentPage>) {
    const res = await request.put<any, ApiResult<ContentPage>>(`/admin/pages/content-pages/${encodeURIComponent(slug)}`, payload)
    return unwrapResponse(res)
  },
  async listFriendlyLinks() {
    const res = await request.get<any, ApiResult<{ links: FriendlyLink[], settings: { enabled: boolean } }>>('/admin/pages/friendly-links')
    return unwrapResponse(res)
  },
  async updateFriendlyLinkSettings(enabled: boolean) {
    const res = await request.put<any, ApiResult<{ enabled: boolean }>>('/admin/pages/friendly-links/settings', { enabled })
    return unwrapResponse(res)
  },
  async createFriendlyLink(payload: Partial<FriendlyLink>) {
    const res = await request.post<any, ApiResult<FriendlyLink>>('/admin/pages/friendly-links', payload)
    return unwrapResponse(res)
  },
  async updateFriendlyLink(id: number, payload: Partial<FriendlyLink>) {
    const res = await request.put<any, ApiResult<FriendlyLink>>(`/admin/pages/friendly-links/${id}`, payload)
    return unwrapResponse(res)
  },
  async deleteFriendlyLink(id: number) {
    const res = await request.post<any, ApiResult<boolean>>('/admin/pages/friendly-links/delete', { id })
    return unwrapResponse(res)
  },
}


// ==================== Home Content API ====================

export const homeApi = {
  /** 获取热门搜索（前台） */
  getHotSearches() {
    return request.get<any, { id: number; name: string; count: number; tag_type: string; sort_order: number }[]>('/home/searches')
  },

  /** 获取热门排行榜（前台） */
  getHotRankings(params?: { type?: string; category?: string; limit?: number }) {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.category) qs.set('category', params.category)
    if (params?.limit) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return request.get<any, RankingItem[]>(`/home/rankings${q ? `?${q}` : ''}`)
  },

  /** 按类型分组获取所有排行榜（独立排行榜页用） */
  getRankingsGrouped(category?: string, perRank?: number) {
    const qs = new URLSearchParams()
    if (category) qs.set('category', category)
    if (perRank) qs.set('perRank', String(perRank))
    const q = qs.toString()
    return request.get<any, RankingGroupedResponse>(`/home/rankings/grouped${q ? `?${q}` : ''}`)
  },

  /** 获取榜单类型 + 分类常量 */
  getRankingMeta() {
    return request.get<any, { types: RankTypeMeta[]; categories: string[] }>('/home/rankings/meta')
  },

  /** 获取热门标签（前台） */
  getHotTags() {
    return request.get<any, { id: number; name: string; sort_order: number }[]>('/home/tags')
  },

  /** 获取所有已采集或已缓存到本地的小说 */
  getLocalLibrary(params?: { keyword?: string; category?: string; page?: number; pageSize?: number }) {
    const qs = new URLSearchParams()
    if (params?.keyword) qs.set('keyword', params.keyword)
    if (params?.category) qs.set('category', params.category)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
    const q = qs.toString()
    return request.get<any, LocalLibraryResponse>(`/home/library${q ? `?${q}` : ''}`)
  },

  /** 获取所有热门搜索（管理后台） */
  getAllHotSearches() {
    return request.get<any, any[]>('/home/searches/all')
  },

  /** 添加热门搜索 */
  addHotSearch(data: { name: string; count: number; tag_type: string; sort_order: number }) {
    return request.post<any, { id: number }>('/home/searches', data)
  },

  /** 更新热门搜索 */
  updateHotSearch(data: { id: number; name: string; count: number; tag_type: string; sort_order: number; is_active?: boolean }) {
    return request.put<any, void>('/home/searches', data)
  },

  /** 删除热门搜索 */
  deleteHotSearch(id: number) {
    return request.post<any, void>('/home/searches/delete', { id })
  },

  /** 获取所有热门排行榜（管理后台） */
  getAllHotRankings(params?: { type?: string; category?: string }) {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.category) qs.set('category', params.category)
    const q = qs.toString()
    return request.get<any, any[]>(`/home/rankings/all${q ? `?${q}` : ''}`)
  },

  /** 一键根据用户阅读情况自动刷新排行榜 */
  refreshRankings() {
    return request.post<any, { inserted: number; sourceCount: number }>('/home/rankings/refresh', {})
  },

  /** 添加热门排行榜 */
  addHotRanking(data: Record<string, any>) {
    return request.post<any, { id: number }>('/home/rankings', data)
  },

  /** 更新热门排行榜 */
  updateHotRanking(data: Record<string, any> & { id: number }) {
    return request.put<any, void>('/home/rankings', data)
  },

  /** 删除热门排行榜 */
  deleteHotRanking(id: number) {
    return request.post<any, void>('/home/rankings/delete', { id })
  },

  /** 获取所有热门标签（管理后台） */
  getAllHotTags() {
    return request.get<any, any[]>('/home/tags/all')
  },

  /** 添加热门标签 */
  addHotTag(data: { name: string; sort_order: number }) {
    return request.post<any, { id: number }>('/home/tags', data)
  },

  /** 更新热门标签 */
  updateHotTag(data: { id: number; name: string; sort_order: number; is_active?: boolean }) {
    return request.put<any, void>('/home/tags', data)
  },

  /** 删除热门标签 */
  deleteHotTag(id: number) {
    return request.post<any, void>('/home/tags/delete', { id })
  },
}

// ==================== Advertisement API ====================

export interface Advertisement {
  id: number
  position: string
  title: string
  image_url: string
  link_url: string
  content: string
  ad_type: 'image' | 'text' | 'html'
  target: string
  sort_order: number
  popup_interval_seconds?: number
  popup_auto_close_seconds?: number
  start_time: string | null
  end_time: string | null
  is_active: boolean | number
  remark: string
  created_at?: string
  updated_at?: string
}

export const adApi = {
  /** 公开：按广告位置获取启用中的广告 */
  getAdsByPosition(position: string) {
    return request.get<any, Advertisement[]>(`/ads/list?position=${encodeURIComponent(position)}`)
  },

  /** 管理：获取所有广告（可按 position 过滤） */
  getAllAds(position?: string) {
    const url = position ? `/ads/all?position=${encodeURIComponent(position)}` : '/ads/all'
    return request.get<any, Advertisement[]>(url)
  },

  /** 添加广告 */
  addAd(data: Partial<Advertisement>) {
    return request.post<any, { id: number }>('/ads', data)
  },

  /** 更新广告 */
  updateAd(data: Partial<Advertisement> & { id: number }) {
    return request.put<any, void>('/ads', data)
  },

  /** 删除广告 */
  deleteAd(id: number) {
    return request.post<any, void>('/ads/delete', { id })
  },
}

// ==================== Site Config API ====================

function encodeSiteConfigForTransport(item: { config_key: string; config_value: string }) {
  if (item.config_key !== 'analytics_code') return item
  const value = item.config_value || ''
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return {
    ...item,
    config_value: `__BASE64__:${btoa(binary)}`,
  }
}

export const configApi = {
  /** 获取单个配置 */
  getConfig(key: string) {
    return request.get<any, { config_key: string; config_value: string }>(`/config/${key}`)
  },

  /** 获取所有配置（管理后台） */
  getAllConfigs() {
    return request.get<any, SiteConfigItem[]>('/config')
  },

  /** 获取公开站点配置（前台展示用） */
  getPublicConfigs() {
    return request.get<any, SiteConfigItem[]>('/config/public/all')
  },

  /** 更新单个配置 */
  updateConfig(data: { config_key: string; config_value: string }) {
    return request.put<any, void>('/config', encodeSiteConfigForTransport(data))
  },

  /** 批量更新配置 */
  updateConfigs(configs: { config_key: string; config_value: string }[]) {
    return request.put<any, void>('/config/batch', configs.map(encodeSiteConfigForTransport))
  },

  /** 发送测试邮件 */
  testEmail(data: { to: string }) {
    return request.post<any, void>('/config/email/test', data)
  },

  /** 检测搜索/换源代理 */
  testProxy(data: { proxy: string; userAgents?: string }) {
    return request.post<any, {
      ok: boolean
      total: number
      available: number
      results: Array<{
        ok: boolean
        proxy: string
        targetUrl: string
        status?: number
        elapsedMs?: number
        outboundIp?: string
        userAgent?: string
        error?: string
        message?: string
      }>
    }>('/config/proxy/test', data)
  },
}

export default request

// ==================== Settings API ====================

export const settingsApi = {
  /** 获取 APP 设置 */
  getAppSettings() {
    return request.get<any, { legadoAppUrl: string }>('/book/app-settings')
  },

  /** 设置 APP 地址 */
  setAppSettings(data: { legadoAppUrl: string }) {
    return request.post<any, void>('/book/app-settings', data)
  },
}
