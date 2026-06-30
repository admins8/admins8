/**
 * 简单内存缓存工具
 * 用于缓存不常变化的数据（如站点配置、统计数据等）
 */

interface CacheEntry<T> {
  data: T
  expiry: number
}

const cache = new Map<string, CacheEntry<any>>()

/**
 * 获取缓存，如果过期或不存在返回 null
 */
export function getCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

/**
 * 设置缓存
 * @param key 缓存键
 * @param data 缓存数据
 * @param ttlMs 过期时间（毫秒），默认60秒
 */
export function setCache<T>(key: string, data: T, ttlMs: number = 60000): void {
  cache.set(key, { data, expiry: Date.now() + ttlMs })
}

/**
 * 清除缓存
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}
