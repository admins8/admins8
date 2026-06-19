import { getSharedRedisClient } from './redisClient'

export interface SearchSlot {
  acquired: boolean
  message?: string
  release: () => void | Promise<void>
}

export class SearchConcurrencyPool {
  private active = 0

  constructor(private readonly maxConcurrent: number) {}

  tryAcquire(): SearchSlot {
    if (this.active >= this.maxConcurrent) {
      return {
        acquired: false,
        message: '当前搜索人数较多，请稍后',
        release: () => {},
      }
    }

    this.active += 1
    let released = false
    return {
      acquired: true,
      release: () => {
        if (released) return
        released = true
        this.active = Math.max(0, this.active - 1)
      },
    }
  }

  getActiveCount(): number {
    return this.active
  }
}

type RedisProvider = () => Promise<any | null>

const SEARCH_ACTIVE_KEY = 'legado:search:active'
const SEARCH_ACTIVE_TTL_SECONDS = 120
const fallbackPools = new Map<number, SearchConcurrencyPool>()

function getFallbackPool(maxConcurrent: number): SearchConcurrencyPool {
  let pool = fallbackPools.get(maxConcurrent)
  if (!pool) {
    pool = new SearchConcurrencyPool(maxConcurrent)
    fallbackPools.set(maxConcurrent, pool)
  }
  return pool
}

export async function acquireSearchSlot(
  maxConcurrent: number,
  redisProvider: RedisProvider = getSharedRedisClient
): Promise<SearchSlot> {
  try {
    const redis = await redisProvider()
    if (redis) {
      const count = await redis.incr(SEARCH_ACTIVE_KEY)
      await redis.expire(SEARCH_ACTIVE_KEY, SEARCH_ACTIVE_TTL_SECONDS)
      if (count > maxConcurrent) {
        await redis.decr(SEARCH_ACTIVE_KEY)
        return {
          acquired: false,
          message: '当前搜索人数较多，请稍后',
          release: () => {},
        }
      }

      let released = false
      return {
        acquired: true,
        release: async () => {
          if (released) return
          released = true
          try {
            await redis.decr(SEARCH_ACTIVE_KEY)
          } catch (err: any) {
            console.warn('[搜索并发池] Redis 释放搜索槽失败:', err?.message || err)
          }
        },
      }
    }
  } catch (err: any) {
    console.warn('[搜索并发池] Redis 不可用，降级为进程内并发池:', err?.message || err)
  }

  return getFallbackPool(maxConcurrent).tryAcquire()
}
