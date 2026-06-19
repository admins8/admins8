import { createClient, type RedisClientType } from 'redis'
import { config } from '../config'

let redisClient: RedisClientType | null = null
let redisConnecting: Promise<RedisClientType | null> | null = null

export async function getSharedRedisClient(): Promise<RedisClientType | null> {
  if (!config.redis.enabled) return null
  if (redisClient?.isOpen) return redisClient
  if (redisConnecting) return redisConnecting

  redisConnecting = (async () => {
    try {
      const client = createClient({
        url: config.redis.url,
        socket: {
          connectTimeout: config.redis.connectTimeout,
          reconnectStrategy: false,
        },
      })
      client.on('error', (err) => {
        console.warn('[Redis] 连接异常:', err.message)
      })
      await client.connect()
      redisClient = client as RedisClientType
      console.log('[Redis] 已连接')
      return redisClient
    } catch (err: any) {
      console.warn('[Redis] 不可用，相关功能将降级:', err?.message || err)
      redisClient = null
      return null
    } finally {
      redisConnecting = null
    }
  })()

  return redisConnecting
}

export async function closeSharedRedisClient(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit()
  }
  redisClient = null
  redisConnecting = null
}
