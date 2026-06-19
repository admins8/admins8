type RedisProvider = () => Promise<any | null>;
export declare function sortSourcesByHealth<T extends Record<string, any>>(sources: T[], redisProvider?: RedisProvider): Promise<T[]>;
export declare function recordSourceHealth(source: any, success: boolean, durationMs: number, redisProvider?: RedisProvider): Promise<void>;
export {};
//# sourceMappingURL=sourceHealth.d.ts.map