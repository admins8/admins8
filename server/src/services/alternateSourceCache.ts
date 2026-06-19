import crypto from 'crypto'
import { getSharedRedisClient } from './redisClient'

type RedisProvider = () => Promise<any | null>

export interface AlternateSourceCacheContext {
  bookUrl: string
  name?: string
  author?: string
  sourceUrl?: string
  chapterIndex?: number
}

export function buildAlternateSourceCacheKey(context: AlternateSourceCacheContext): string {
  const raw = [
    context.bookUrl || '',
    context.name || '',
    context.author || '',
    context.sourceUrl || '',
    String(context.chapterIndex ?? ''),
  ].join('|').trim().toLowerCase()
  const hash = crypto.createHash('sha1').update(raw).digest('hex')
  return `legado:alternate-sources:${hash}`
}

export async function getAlternateSourceCache(
  key: string,
  redisProvider: RedisProvider = getSharedRedisClient
): Promise<any[] | null> {
  try {
    const redis = await redisProvider()
    if (!redis) return null
    const raw = await redis.get(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch (err: any) {
    console.warn('[换源缓存] 读取失败，跳过缓存:', err?.message || err)
    return null
  }
}

export async function setAlternateSourceCache(
  key: string,
  sources: any[],
  ttlSeconds: number,
  redisProvider: RedisProvider = getSharedRedisClient
): Promise<void> {
  if (ttlSeconds <= 0 || sources.length === 0) return
  try {
    const redis = await redisProvider()
    if (!redis) return
    await redis.setEx(key, ttlSeconds, JSON.stringify(sources))
  } catch (err: any) {
    console.warn('[换源缓存] 写入失败:', err?.message || err)
  }
}
