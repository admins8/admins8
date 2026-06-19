"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = createRateLimiter;
exports.rateLimit = rateLimit;
const redisClient_1 = require("../services/redisClient");
const ipStore = new Map();
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
function memoryLimit(ip, windowMs, maxRequests) {
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
function createRateLimiter(windowMs, maxRequests, redisProvider = redisClient_1.getSharedRedisClient) {
    return async (req, res, next) => {
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
        }
        catch (err) {
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
function rateLimit(windowMs, maxRequests) {
    return createRateLimiter(windowMs, maxRequests);
}
//# sourceMappingURL=rateLimit.js.map