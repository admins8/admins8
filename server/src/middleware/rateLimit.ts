import { Request, Response, NextFunction } from 'express';
import { getSharedRedisClient } from '../services/redisClient';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const ipStore = new Map<string, RateLimitEntry>();
type RedisProvider = () => Promise<any | null>;

// 每 60 秒清理一次过期记录
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipStore.entries()) {
    if (entry.resetTime < now) {
      ipStore.delete(ip);
    }
  }
}, 60000);
cleanupTimer.unref?.();

function memoryLimit(ip: string, windowMs: number, maxRequests: number): boolean {
  const now = Date.now();
  const entry = ipStore.get(ip);

  if (!entry || entry.resetTime < now) {
    ipStore.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  redisProvider: RedisProvider = getSharedRedisClient
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    try {
      const redis = await redisProvider();
      if (redis) {
        const key = `legado:ratelimit:${windowMs}:${ip}`;
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, Math.ceil(windowMs / 1000));
        }
        if (count > maxRequests) {
          res.status(429).json({ code: 429, msg: '请求过于频繁，请稍后再试' });
          return;
        }
        next();
        return;
      }
    } catch (err: any) {
      console.warn('[RateLimit] Redis 限流不可用，降级为内存限流:', err?.message || err);
    }

    if (!memoryLimit(ip, windowMs, maxRequests)) {
      res.status(429).json({ code: 429, msg: '请求过于频繁，请稍后再试' });
      return;
    }

    next();
  };
}

/**
 * Redis 优先、内存回退的速率限制中间件
 * @param windowMs 时间窗口（毫秒）
 * @param maxRequests 窗口内最大请求数
 */
export function rateLimit(windowMs: number, maxRequests: number) {
  return createRateLimiter(windowMs, maxRequests);
}
