"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSharedRedisClient = getSharedRedisClient;
exports.closeSharedRedisClient = closeSharedRedisClient;
const redis_1 = require("redis");
const config_1 = require("../config");
let redisClient = null;
let redisConnecting = null;
async function getSharedRedisClient() {
    if (!config_1.config.redis.enabled)
        return null;
    if (redisClient?.isOpen)
        return redisClient;
    if (redisConnecting)
        return redisConnecting;
    redisConnecting = (async () => {
        try {
            const client = (0, redis_1.createClient)({
                url: config_1.config.redis.url,
                socket: {
                    connectTimeout: config_1.config.redis.connectTimeout,
                    reconnectStrategy: false,
                },
            });
            client.on('error', (err) => {
                console.warn('[Redis] 连接异常:', err.message);
            });
            await client.connect();
            redisClient = client;
            console.log('[Redis] 已连接');
            return redisClient;
        }
        catch (err) {
            console.warn('[Redis] 不可用，相关功能将降级:', err?.message || err);
            redisClient = null;
            return null;
        }
        finally {
            redisConnecting = null;
        }
    })();
    return redisConnecting;
}
async function closeSharedRedisClient() {
    if (redisClient?.isOpen) {
        await redisClient.quit();
    }
    redisClient = null;
    redisConnecting = null;
}
//# sourceMappingURL=redisClient.js.map