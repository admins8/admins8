export interface ApiResponse<T> {
  code: number
  msg?: string
  data: T
}

export type ApiResult<T> = ApiResponse<T> | T

export function unwrapResponse<T>(res: ApiResult<T>): T {
  if (res && typeof res === 'object' && 'code' in res && 'data' in res) {
    const apiRes = res as ApiResponse<T>
    if (apiRes.code !== 0) {
      throw new Error(apiRes.msg || `请求失败 (code: ${apiRes.code})`)
    }
    return apiRes.data
  }
  return res as T
}

export interface User {
  id: string
  username: string
  email: string
  role: 'user' | 'admin' | 'test' | 'superadmin'
  permissions?: string[]
  avatar?: string
  avatar_url?: string
  createdAt?: string
  created_at?: string
  lastLoginAt?: string
  last_login_at?: string
  membership_type?: string
  membership_expire_at?: string
  membership_start_at?: string
  member_badge?: string
  isMember?: boolean
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
  sourceName?: string
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
  type?: number
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

// ===== 会员相关类型 =====

export interface MembershipConfig {
  id: number
  product_type: string
  name: string
  price: number
  sale_price: number
  duration_days: number
  badge_icon: string
  badge_color: string
  description: string
  is_active: number
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface MemberOrder {
  id: number
  user_id: number
  username?: string
  order_no: string
  trade_no: string
  product_type: string
  amount: number
  pay_amount: number
  pay_channel: string
  status: string
  paid_at?: string
  created_at?: string
}

export interface PaymentConfig {
  id: number
  channel: string
  app_id: string
  merchant_id: string
  private_key?: string
  public_key?: string
  api_key?: string
  notify_url: string
  is_active: number
  created_at?: string
  updated_at?: string
}

export interface MemberStatus {
  id: number
  username: string
  membership_type: string
  membership_expire_at?: string
  membership_start_at?: string
  member_badge: string
  isMember: boolean
}
