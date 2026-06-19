"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAlternateSourceCacheKey = buildAlternateSourceCacheKey;
exports.getAlternateSourceCache = getAlternateSourceCache;
exports.setAlternateSourceCache = setAlternateSourceCache;
const crypto_1 = __importDefault(require("crypto"));
const redisClient_1 = require("./redisClient");
function buildAlternateSourceCacheKey(context) {
    const raw = [
        context.bookUrl || '',
        context.name || '',
        context.author || '',
        context.sourceUrl || '',
        String(context.chapterIndex ?? ''),
    ].join('|').trim().toLowerCase();
    const hash = crypto_1.default.createHash('sha1').update(raw).digest('hex');
    return `legado:alternate-sources:${hash}`;
}
async function getAlternateSourceCache(key, redisProvider = redisClient_1.getSharedRedisClient) {
    try {
        const redis = await redisProvider();
        if (!redis)
            return null;
        const raw = await redis.get(key);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    }
    catch (err) {
        console.warn('[换源缓存] 读取失败，跳过缓存:', err?.message || err);
        return null;
    }
}
async function setAlternateSourceCache(key, sources, ttlSeconds, redisProvider = redisClient_1.getSharedRedisClient) {
    if (ttlSeconds <= 0 || sources.length === 0)
        return;
    try {
        const redis = await redisProvider();
        if (!redis)
            return;
        await redis.setEx(key, ttlSeconds, JSON.stringify(sources));
    }
    catch (err) {
        console.warn('[换源缓存] 写入失败:', err?.message || err);
    }
}
//# sourceMappingURL=alternateSourceCache.js.map