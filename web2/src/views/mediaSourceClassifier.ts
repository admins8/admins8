export interface MediaSourceLike {
  bookSourceName?: string
  bookSourceGroup?: string
  bookSourceComment?: string
}

const MEDIA_SOURCE_PATTERN = /漫画|漫蛙|喜漫|comic|有声|听书|听读|喜马拉雅|音频|图片|写真|图库|图集|短剧|剧集|影视|视频/i

export function isMediaLikeSource(source: MediaSourceLike): boolean {
  const text = `${source.bookSourceName || ''} ${source.bookSourceGroup || ''} ${source.bookSourceComment || ''}`
  return MEDIA_SOURCE_PATTERN.test(text)
}
