export declare const DEFAULT_PREFETCH_CHAPTER_COUNT = 5;
export declare const DEFAULT_RUNTIME_CONTENT_TTL_MS: number;
export declare function getPrefetchChapterIndexes(chapterIndex: number, count?: number): number[];
export declare function getRuntimeChapterContent(bookUrl: string, chapterIndex: number, now?: number): string | null;
export declare function setRuntimeChapterContent(bookUrl: string, chapterIndex: number, content: string, ttlMs?: number, now?: number): void;
export declare function clearRuntimeChapterContentCache(): void;
//# sourceMappingURL=chapterRuntimeCache.d.ts.map