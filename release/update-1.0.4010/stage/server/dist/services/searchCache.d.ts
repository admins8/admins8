export interface SearchCacheOptions {
    enabled: boolean;
    ttlSeconds: number;
}
export interface SearchCacheClient {
    get(key: string): Promise<string | null>;
    setEx(key: string, seconds: number, value: string): Promise<unknown>;
}
export declare function normalizeSearchKeyword(keyword: string): string;
export declare function buildSearchCacheKey(keyword: string): string;
export declare class SearchCache {
    private readonly client;
    private readonly options;
    constructor(client: SearchCacheClient | null, options: SearchCacheOptions);
    get<T = any[]>(keyword: string): Promise<T | null>;
    set(keyword: string, results: any[]): Promise<void>;
}
export declare function getSearchCache(): Promise<SearchCache>;
export declare function closeRedis(): Promise<void>;
//# sourceMappingURL=searchCache.d.ts.map