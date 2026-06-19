import { type RedisClientType } from 'redis';
export declare function getSharedRedisClient(): Promise<RedisClientType | null>;
export declare function closeSharedRedisClient(): Promise<void>;
//# sourceMappingURL=redisClient.d.ts.map