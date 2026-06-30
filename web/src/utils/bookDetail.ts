import type { SearchResult } from '@/api'

export interface DetailSeoBook {
  name?: string
  author?: string
  intro?: string
  kind?: string
  latestChapterTitle?: string
  sourceName?: string
}

export const DETAIL_BOOK_STORAGE_PREFIX = 'legado:book-detail:'
export const DETAIL_CHAPTERS_STORAGE_PREFIX = 'legado:book-chapters:'

export const defaultDetailSeoTemplates = {
  detail_title_template: '{bookName}全文免费阅读_{bookName}最新章节_{siteName}',
  detail_keywords_template: '{bookName},{author},{bookName}最新章节,{bookName}全文阅读',
  detail_description_template: '{bookName}是{author}创作的小说，最新章节：{latestChapter}。{intro}',
}

export function getDetailStorageKey(bookUrl: string) {
  return DETAIL_BOOK_STORAGE_PREFIX + encodeURIComponent(bookUrl)
}

export function getChaptersStorageKey(bookUrl: string) {
  return DETAIL_CHAPTERS_STORAGE_PREFIX + encodeURIComponent(bookUrl)
}

export function saveDetailBook(book: SearchResult) {
  if (!book?.bookUrl) return
  sessionStorage.setItem(getDetailStorageKey(book.bookUrl), JSON.stringify(book))
}

export function loadDetailBook(bookUrl: string): SearchResult | null {
  if (!bookUrl) return null
  const raw = sessionStorage.getItem(getDetailStorageKey(bookUrl))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export interface CachedChapter {
  url: string
  title: string
  index: number
}

/** 将章节列表缓存到 sessionStorage，实现详情页秒开 */
export function saveDetailChapters(bookUrl: string, chapters: CachedChapter[]) {
  if (!bookUrl || !chapters?.length) return
  try {
    sessionStorage.setItem(getChaptersStorageKey(bookUrl), JSON.stringify(chapters))
  } catch { /* storage full, ignore */ }
}

/** 从 sessionStorage 读取章节列表缓存 */
export function loadDetailChapters(bookUrl: string): CachedChapter[] | null {
  if (!bookUrl) return null
  const raw = sessionStorage.getItem(getChaptersStorageKey(bookUrl))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function renderDetailSeoTemplate(template: string, book: DetailSeoBook, siteName = '搜书网') {
  const safe = (value?: string) => String(value || '').trim()
  return String(template || '')
    .replace(/\{bookName\}/g, safe(book.name) || '小说')
    .replace(/\{author\}/g, safe(book.author) || '未知作者')
    .replace(/\{intro\}/g, safe(book.intro))
    .replace(/\{category\}/g, safe(book.kind))
    .replace(/\{latestChapter\}/g, safe(book.latestChapterTitle) || '最新章节')
    .replace(/\{sourceName\}/g, safe(book.sourceName))
    .replace(/\{siteName\}/g, siteName)
}
