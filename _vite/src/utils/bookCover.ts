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
    ['#4A90E2', '#7B68EE'],
    ['#F5A623', '#F08080'],
    ['#50C9C3', '#96DEDA'],
    ['#FFB75E', '#ED8F03'],
    ['#7F7FD5', '#86A8E7'],
    ['#F093FB', '#F5576C'],
    ['#43E97B', '#38F9D7'],
    ['#667eea', '#764ba2'],
    ['#30cfd0', '#330867'],
    ['#ee9ca7', '#ffdde1'],
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

function wrapName(name: string): string[] {
  const raw = String(name || '').trim()
  if (!raw) return ['']
  const maxFirstLine = 8
  if (raw.length <= maxFirstLine) return [raw]
  const breakChars = [' ', '-', '_', '·', '：', ':', '《', '【', '（', '(']
  let splitIdx = maxFirstLine
  for (let i = maxFirstLine; i >= Math.max(1, maxFirstLine - 4); i--) {
    if (breakChars.includes(raw[i])) {
      splitIdx = i + 1
      break
    }
  }
  return [raw.slice(0, splitIdx).trim(), raw.slice(splitIdx).trim()]
}

export function generateBookCover(
  bookName: string,
  author = '',
  siteTitle = '搜书网',
  size: [number, number] = [240, 340]
): string {
  const [w, h] = size
  const [c1, c2] = pickGradient(bookName || 'book')
  const nameLines = wrapName(bookName)
  const authorText = escapeHtml(String(author || '').trim())
  const siteText = escapeHtml(String(siteTitle || '').trim())

  const fontSizeTitle = nameLines.length > 1 ? 22 : 28
  const fontSizeAuthor = 14
  const fontSizeSite = 12

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
    `<circle cx="${w - 20}" cy="${h - 40}" r="80" fill="rgba(255,255,255,0.08)"/>` +
    `<circle cx="${w - 60}" cy="40" r="40" fill="rgba(255,255,255,0.08)"/>` +
    `<g fill="#ffffff" font-family="'PingFang SC','Microsoft YaHei','Helvetica Neue',Arial,sans-serif"` +
      ` font-weight="700" text-anchor="middle">` +
      nameLines.map((line, idx) => {
        const y = h * 0.45 + idx * (fontSizeTitle + 6) - (nameLines.length - 1) * (fontSizeTitle + 6) / 2
        return `<text x="${w / 2}" y="${y}" font-size="${fontSizeTitle}">${escapeHtml(line)}</text>`
      }).join('') +
      (authorText
        ? `<text x="${w / 2}" y="${h * 0.62}" font-size="${fontSizeAuthor}" fill="rgba(255,255,255,0.9)" font-weight="400">${authorText}</text>`
        : '') +
    `</g>` +
    (siteText
      ? `<text x="${w / 2}" y="${h - 18}" text-anchor="middle"` +
        ` fill="rgba(255,255,255,0.75)" font-size="${fontSizeSite}"` +
        ` font-family="'PingFang SC','Microsoft YaHei','Helvetica Neue',Arial,sans-serif">` +
        `${siteText}</text>`
      : '') +
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
  if (hasValidCoverUrl(coverUrl)) return coverUrl as string
  if (hasValidCoverUrl(_defaultBookCoverUrl)) return _defaultBookCoverUrl
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
