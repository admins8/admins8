"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchCache = void 0;
exports.normalizeSearchKeyword = normalizeSearchKeyword;
exports.buildSearchCacheKey = buildSearchCacheKey;
exports.getSearchCache = getSearchCache;
exports.closeRedis = closeRedis;
const config_1 = require("../config");
const redisClient_1 = require("./redisClient");
function normalizeSearchKeyword(keyword) {
    return String(keyword || '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function buildSearchCacheKey(keyword) {
    return `legado:search:v2:${normalizeSearchKeyword(keyword)}`;
}
class SearchCache {
    client;
    options;
    constructor(client, options) {
        this.client = client;
        this.options = options;
    }
    async get(keyword) {
        if (!this.options.enabled || !this.client)
            return null;
        const normalized = normalizeSearchKeyword(keyword);
        if (!normalized)
            return null;
        try {
            const raw = await this.client.get(buildSearchCacheKey(normalized));
            if (!raw)
                return null;
            return JSON.parse(raw);
        }
        catch (err) {
            console.warn('[Redis] 读取搜索缓存失败:', err?.message || err);
            return null;
        }
    }
    async set(keyword, results) {
        if (!this.options.enabled || !this.client)
            return;
        const normalized = normalizeSearchKeyword(keyword);
        if (!normalized)
            return;
        try {
            await this.client.setEx(buildSearchCacheKey(normalized), this.options.ttlSeconds, JSON.stringify(results || []));
        }
        catch (err) {
            console.warn('[Redis] 写入搜索缓存失败:', err?.message || err);
        }
    }
}
exports.SearchCache = SearchCache;
async function getRedisClient() {
    return (0, redisClient_1.getSharedRedisClient)();
}
async function getSearchCache() {
    const client = await getRedisClient();
    return new SearchCache(client, {
        enabled: config_1.config.redis.enabled,
        ttlSeconds: config_1.config.redis.searchTtlSeconds,
    });
}
async function closeRedis() {
    await (0, redisClient_1.closeSharedRedisClient)();
}
//# sourceMappingURL=searchCache.js.map