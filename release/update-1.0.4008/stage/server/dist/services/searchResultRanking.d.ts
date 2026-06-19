export declare function normalizeSearchText(value: unknown): string;
export declare function getSearchMatchScore(keyword: string, bookName: unknown): number;
export type SearchMatchLevel = 'exact' | 'related' | 'weak' | 'none';
export declare function classifySearchResult(keyword: string, book: {
    name?: unknown;
    author?: unknown;
}): {
    level: SearchMatchLevel;
    label: string;
    score: number;
};
export declare function rankSearchResults<T extends {
    name?: unknown;
    author?: unknown;
    sourceName?: unknown;
    originName?: unknown;
    kind?: unknown;
    _tocVerified?: unknown;
    _readable?: unknown;
    _contentVerified?: unknown;
    _local?: unknown;
}>(keyword: string, results: T[]): T[];
export interface AggregatedSearchSource {
    bookUrl: string;
    sourceUrl?: string;
    sourceName?: string;
    coverUrl?: string;
    intro?: string;
    kind?: string;
    latestChapterTitle?: string;
    wordCount?: string;
    type?: number;
    _tocVerified?: boolean;
    _contentVerified?: boolean;
    _readable?: boolean;
    _matchLevel?: string;
    _matchLabel?: string;
    _matchScore?: number;
}
export type AggregatedSearchResult<T> = T & {
    _aggregateKey: string;
    sourceCount: number;
    sources: AggregatedSearchSource[];
    _local?: boolean;
    _tocVerified?: boolean;
    _contentVerified?: boolean;
    _readable?: boolean;
};
export declare function getAggregateKey(book: {
    name?: unknown;
    author?: unknown;
}): string;
export declare function aggregateSearchResults<T extends {
    name?: unknown;
    author?: unknown;
    bookUrl?: unknown;
    sourceUrl?: unknown;
    sourceName?: unknown;
}>(keyword: string, results: T[]): Array<AggregatedSearchResult<T>>;
export declare function shouldEmitImmediateSearchResult(book: {
    _matchLevel?: unknown;
    _readable?: unknown;
}, options?: {
    forceVerifyToc?: boolean;
}): boolean;
export declare function getSearchWindow<T>(sources: T[], startIndex: number, maxScanCount?: number): {
    totalSources: number;
    remainingSources: T[];
    hasMore: boolean;
    searchedLimit: number;
};
//# sourceMappingURL=searchResultRanking.d.ts.map