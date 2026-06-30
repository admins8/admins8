/**
 * 书籍封面自动生成工具
 *  - 优先使用书籍自身的 coverUrl
 *  - 若没有/加载失败 → 检查是否有后台配置的全局默认封面 (setDefaultBookCoverUrl)
 *  - 都没有 → 生成渐变 SVG 封面（中间为书名，下方为作者，底部为站点标题）
 */

// ===================== 全局默认封面（后台配置驱动） =====================

let _defaultBookCoverUrl = ''

/** 设置后台配置的默认封面 URL（通常在应用启动时调用） */
export function setDefaultBookCoverUrl(url: string | null | undefined) {
  _defaultBookCoverUrl = String(url || '').trim()
}

/** 获取当前全局默认封面 URL */
export function getDefaultBookCoverUrl(): string {
  return _defaultBookCoverUrl
}

// ===================== SVG 自动生成封面 =====================

function pickGradient(name: string): [string, string] {
  const palette: Array<[string, string]> = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a18cd1', '#fbc2eb'],
    ['#fccb90', '#d57eeb'],
    ['#e0c3fc', '#8ec5fc'],
    ['#f5576c', '#ff6f61'],
    ['#4facfe', '#00f2fe'],
    ['#6a11cb', '#2575fc'],
    ['#ff9a9e', '#fecfef'],
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return palette[Math.abs(hash) % palette.length]
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 书名单行截断：最多8字，超过省略 */
function truncateName(name: string): string {
  const raw = String(name || '').trim()
  if (!raw) return ''
  const maxChars = 8
  if (raw.length <= maxChars) return raw
  return raw.slice(0, 5) + '...'
}

export function generateBookCover(
  bookName: string,
  author = '',
  siteTitle = '搜书网',
  size: [number, number] = [240, 340]
): string {
  const [w, h] = size
  const [c1, c2] = pickGradient(bookName || 'book')
  const displayName = truncateName(bookName)
  const authorText = escapeHtml(String(author || '').trim())
  const siteText = escapeHtml(String(siteTitle || '').trim())
  const fontFamily = "'PingFang SC','Microsoft YaHei','Helvetica Neue',Arial,sans-serif"

  const fontSizeTitle = 28
  const fontSizeAuthor = 15
  const fontSizeSite = 11

  // 书名区域：单行居中
  const nameY = h * 0.35
  const nameText = `<text x="${w / 2}" y="${nameY}" font-size="${fontSizeTitle}" fill="#ffffff" font-weight="700">${escapeHtml(displayName)}</text>`

  // 作者区域：书名下方，带分隔线
  const authorBlockY = nameY + 35
  const authorBlock = authorText
    ? `<line x1="${w * 0.2}" y1="${authorBlockY}" x2="${w * 0.8}" y2="${authorBlockY}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>` +
      `<text x="${w / 2}" y="${authorBlockY + 22}" font-size="${fontSizeAuthor}" fill="rgba(255,255,255,0.85)" font-weight="400">${authorText}</text>`
    : ''

  // 网站标题区域：底部
  const siteBlock = siteText
    ? `<rect x="0" y="${h - 36}" width="${w}" height="36" fill="rgba(0,0,0,0.2)"/>` +
      `<text x="${w / 2}" y="${h - 12}" text-anchor="middle" font-size="${fontSizeSite}" fill="rgba(255,255,255,0.7)" font-family="${fontFamily}">${siteText}</text>`
    : ''

  // 装饰元素：半透明书籍边框效果
  const decoration = [
    `<rect x="${w * 0.12}" y="18" width="${w * 0.76}" height="${h - 52}" rx="8" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`,
    `<circle cx="${w - 30}" cy="50" r="60" fill="rgba(255,255,255,0.06)"/>`,
    `<circle cx="30" cy="${h - 60}" r="40" fill="rgba(255,255,255,0.06)"/>`,
  ].join('')

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
      `<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" stop-color="${c1}"/>` +
        `<stop offset="100%" stop-color="${c2}"/>` +
      `</linearGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    decoration +
    `<g font-family="${fontFamily}" text-anchor="middle" font-weight="700">` +
      nameText +
    `</g>` +
    authorBlock +
    siteBlock +
    `</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** 判断一个 URL 是否是有效的图片 URL（非空、非 null 字符串） */
export function hasValidCoverUrl(url?: string | null): boolean {
  if (!url) return false
  const s = String(url).trim().toLowerCase()
  if (!s) return false
  if (s === 'null' || s === 'undefined' || s === 'none') return false
  if (!s.startsWith('http://') && !s.startsWith('https://') && !s.startsWith('data:')) return false
  return true
}

/** 将外部 HTTP 图片 URL 转为后端代理 URL，解决 HTTPS 页面加载 HTTP 图片的 Mixed Content 问题 */
export function proxyImageUrl(url: string): string {
  const s = String(url || '').trim()
  if (!s) return s
  if (s.startsWith('http://')) {
    return `/api/proxy-image?url=${encodeURIComponent(s)}`
  }
  return s
}

/**
 * 解析书籍最终封面：
 * 1) 有有效封面 → 直接返回
 * 2) 有全局默认封面（后台配置）→ 返回全局默认
 * 3) 都没有 → 生成 SVG
 */
export function resolveBookCover(
  coverUrl: string | null | undefined,
  bookName: string,
  author?: string,
  siteTitle?: string,
  size?: [number, number]
): string {
  if (hasValidCoverUrl(coverUrl)) return proxyImageUrl(coverUrl as string)
  if (hasValidCoverUrl(_defaultBookCoverUrl)) return proxyImageUrl(_defaultBookCoverUrl)
  return generateBookCover(bookName, author, siteTitle, size)
}

/**
 * 当图片加载失败时使用：优先返回后台配置的默认封面，其次返回 SVG
 * 配合 el-image @error 事件使用：在 onError 回调里把 :src 替换为 fallback
 */
export function resolveBookCoverFallback(
  bookName: string,
  author?: string,
  siteTitle?: string,
  size?: [number, number]
): string {
  if (hasValidCoverUrl(_defaultBookCoverUrl)) return _defaultBookCoverUrl
  return generateBookCover(bookName, author, siteTitle, size)
}

/** SearchResult 便捷入口 */
export function coverForSearch(
  item: { coverUrl?: string | null; name?: string; author?: string; sourceName?: string },
  siteTitle = '搜书网'
): string {
  return resolveBookCover(item.coverUrl, item.name || '', item.author || '', item.sourceName || siteTitle)
}

// ===================== Vue Composable：统一处理封面加载失败回退 =====================

import { ref } from 'vue'

/**
 * 组件内使用的封面辅助 composable：
 *   const { getCover, onCoverError } = useBookCover()
 *
 * 用法：
 *   <el-image
 *     :src="getCover(item.coverUrl, item.name, item.author, siteTitle)"
 *     @error="() => onCoverError(item.coverUrl, item.name)"
 *     fit="cover"
 *   />
 *
 * 回退顺序：① 原封面 URL → ② 后台配置的"默认书籍封面" → ③ 生成的 SVG 封面
 */
export function useBookCover() {
  const failedSet = ref<Set<string>>(new Set())

  function getCover(
    coverUrl: string | null | undefined,
    bookName: string,
    author?: string,
    siteTitle?: string,
    size?: [number, number]
  ): string {
    const key = (coverUrl && String(coverUrl).trim()) || bookName
    if (failedSet.value.has(key)) {
      return resolveBookCoverFallback(bookName, author, siteTitle, size)
    }
    return resolveBookCover(coverUrl, bookName, author, siteTitle, size)
  }

  function onCoverError(coverUrl: string | null | undefined, bookName: string) {
    const key = (coverUrl && String(coverUrl).trim()) || bookName
    if (!failedSet.value.has(key)) {
      failedSet.value.add(key)
    }
  }

  /** 清空失败记录（重新搜索时可调用，避免跨搜索的缓存污染） */
  function reset() {
    failedSet.value.clear()
  }

  return { getCover, onCoverError, reset }
}
