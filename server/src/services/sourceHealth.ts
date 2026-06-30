import { getSharedRedisClient } from './redisClient'

type RedisProvider = () => Promise<any | null>

function sourceUrlOf(source: any): string {
  return String(source.book_source_url || source.bookSourceUrl || source.sourceUrl || '')
}

function healthKey(sourceUrl: string): string {
  return `legado:source-health:${encodeURIComponent(sourceUrl)}`
}

function baseOrderScore(source: any): number {
  const status = Number(source.last_check_status ?? source.lastCheckStatus ?? 0)
  const validationScore = status === 1 ? 1_000_000 : status === 2 ? -1_000_000 : 0
  return validationScore + Number(source.weight || 0) * 1000 - Number(source.custom_order || source.customOrder || 0)
}

function healthPenalty(record: Record<string, string>): number {
  const failureCount = Number(record.failureCount || 0)
  const successCount = Number(record.successCount || 0)
  const totalTimeMs = Number(record.totalTimeMs || 0)
  const avgTime = successCount > 0 ? totalTimeMs / successCount : 0
  const recentFailure = Number(record.lastFailureAt || 0) > Date.now() - 10 * 60 * 1000 ? 5000 : 0
  return failureCount * 2000 + avgTime + recentFailure
}

export async function sortSourcesByHealth<T extends Record<string, any>>(
  sources: T[],
  redisProvider: RedisProvider = getSharedRedisClient
): Promise<T[]> {
  try {
    const redis = await redisProvider()
    if (!redis) {
      return [...sources]
        .map((source, index) => ({ source, index, score: baseOrderScore(source) }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(item => item.source)
    }
    // 使用 pipeline 批量查询所有书源健康度
    const keys = sources.map(s => healthKey(sourceUrlOf(s)))
    const pipeline = redis.pipeline()
    for (const key of keys) {
      pipeline.hGetAll(key)
    }
    const results = await pipeline.exec()

    const scored = sources.map((source, index) => {
      const record = results?.[index]?.[1] || null
      return {
        source,
        index,
        score: baseOrderScore(source) - healthPenalty(record || {}),
      }
    })
    return scored
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(item => item.source)
  } catch (err: any) {
    console.warn('[书源健康度] 排序失败，使用默认排序:', err?.message || err)
    return sources
  }
}

export async function recordSourceHealth(
  source: any,
  success: boolean,
  durationMs: number,
  redisProvider: RedisProvider = getSharedRedisClient
): Promise<void> {
  const sourceUrl = sourceUrlOf(source)
  if (!sourceUrl) return
  try {
    const redis = await redisProvider()
    if (!redis) return
    const key = healthKey(sourceUrl)
    if (success) {
      await redis.hIncrBy(key, 'successCount', 1)
      await redis.hIncrBy(key, 'totalTimeMs', Math.max(0, Math.round(durationMs)))
      await redis.hSet(key, 'lastSuccessAt', String(Date.now()))
    } else {
      await redis.hIncrBy(key, 'failureCount', 1)
      await redis.hSet(key, 'lastFailureAt', String(Date.now()))
    }
    await redis.expire(key, 7 * 24 * 3600)
  } catch {
    // 健康度只影响排序，不影响主流程
  }
}
