type RedisProvider = () => Promise<any | null>;
export interface AlternateSourceCacheContext {
    bookUrl: string;
    name?: string;
    author?: string;
    sourceUrl?: string;
    chapterIndex?: number;
}
export declare function buildAlternateSourceCacheKey(context: AlternateSourceCacheContext): string;
export declare function getAlternateSourceCache(key: string, redisProvider?: RedisProvider): Promise<any[] | null>;
export declare function setAlternateSourceCache(key: string, sources: any[], ttlSeconds: number, redisProvider?: RedisProvider): Promise<void>;
export {};
//# sourceMappingURL=alternateSourceCache.d.ts.map