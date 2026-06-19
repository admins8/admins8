export interface SearchSlot {
    acquired: boolean;
    message?: string;
    release: () => void | Promise<void>;
}
export declare class SearchConcurrencyPool {
    private readonly maxConcurrent;
    private active;
    constructor(maxConcurrent: number);
    tryAcquire(): SearchSlot;
    getActiveCount(): number;
}
type RedisProvider = () => Promise<any | null>;
export declare function acquireSearchSlot(maxConcurrent: number, redisProvider?: RedisProvider): Promise<SearchSlot>;
export {};
//# sourceMappingURL=searchConcurrency.d.ts.map