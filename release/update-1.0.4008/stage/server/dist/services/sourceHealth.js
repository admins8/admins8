"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortSourcesByHealth = sortSourcesByHealth;
exports.recordSourceHealth = recordSourceHealth;
const redisClient_1 = require("./redisClient");
function sourceUrlOf(source) {
    return String(source.book_source_url || source.bookSourceUrl || source.sourceUrl || '');
}
function healthKey(sourceUrl) {
    return `legado:source-health:${encodeURIComponent(sourceUrl)}`;
}
function baseOrderScore(source) {
    const status = Number(source.last_check_status ?? source.lastCheckStatus ?? 0);
    const validationScore = status === 1 ? 1_000_000 : status === 2 ? -1_000_000 : 0;
    return validationScore + Number(source.weight || 0) * 1000 - Number(source.custom_order || source.customOrder || 0);
}
function healthPenalty(record) {
    const failureCount = Number(record.failureCount || 0);
    const successCount = Number(record.successCount || 0);
    const totalTimeMs = Number(record.totalTimeMs || 0);
    const avgTime = successCount > 0 ? totalTimeMs / successCount : 0;
    const recentFailure = Number(record.lastFailureAt || 0) > Date.now() - 10 * 60 * 1000 ? 5000 : 0;
    return failureCount * 2000 + avgTime + recentFailure;
}
async function sortSourcesByHealth(sources, redisProvider = redisClient_1.getSharedRedisClient) {
    try {
        const redis = await redisProvider();
        if (!redis) {
            return [...sources]
                .map((source, index) => ({ source, index, score: baseOrderScore(source) }))
                .sort((a, b) => b.score - a.score || a.index - b.index)
                .map(item => item.source);
        }
        const scored = await Promise.all(sources.map(async (source, index) => {
            const record = await redis.hGetAll(healthKey(sourceUrlOf(source)));
            return {
                source,
                index,
                score: baseOrderScore(source) - healthPenalty(record || {}),
            };
        }));
        return scored
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .map(item => item.source);
    }
    catch (err) {
        console.warn('[书源健康度] 排序失败，使用默认排序:', err?.message || err);
        return sources;
    }
}
async function recordSourceHealth(source, success, durationMs, redisProvider = redisClient_1.getSharedRedisClient) {
    const sourceUrl = sourceUrlOf(source);
    if (!sourceUrl)
        return;
    try {
        const redis = await redisProvider();
        if (!redis)
            return;
        const key = healthKey(sourceUrl);
        if (success) {
            await redis.hIncrBy(key, 'successCount', 1);
            await redis.hIncrBy(key, 'totalTimeMs', Math.max(0, Math.round(durationMs)));
            await redis.hSet(key, 'lastSuccessAt', String(Date.now()));
        }
        else {
            await redis.hIncrBy(key, 'failureCount', 1);
            await redis.hSet(key, 'lastFailureAt', String(Date.now()));
        }
        await redis.expire(key, 7 * 24 * 3600);
    }
    catch {
        // 健康度只影响排序，不影响主流程
    }
}
//# sourceMappingURL=sourceHealth.js.map