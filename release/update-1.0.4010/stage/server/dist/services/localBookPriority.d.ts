export type LocalMatchLevel = 'exact' | 'related' | 'weak' | 'none';
export interface LocalBookRow {
    bookUrl?: string;
    book_url?: string;
    name?: string;
    author?: string;
    sourceUrl?: string;
    origin?: string;
    sourceName?: string;
    originName?: string;
    coverUrl?: string;
    cover_url?: string;
    intro?: string;
    kind?: string;
    category?: string;
    latestChapterTitle?: string;
    latest_chapter_title?: string;
    wordCount?: string;
    word_count?: string;
    type?: number;
}
export declare function isSameLocalBook(a: Pick<LocalBookRow, 'name' | 'author'>, b: Pick<LocalBookRow, 'name' | 'author'>): boolean;
export declare function buildLocalBookResult(row: LocalBookRow, match: {
    matchLevel: LocalMatchLevel;
    matchLabel: string;
    matchScore: number;
}): {
    bookUrl: string;
    name: string;
    author: string;
    coverUrl: string;
    intro: string;
    sourceUrl: string;
    sourceName: string;
    kind: string;
    latestChapterTitle: string;
    wordCount: string;
    type: number | undefined;
    _local: boolean;
    _readable: boolean;
    _tocVerified: boolean;
    _matchLevel: LocalMatchLevel;
    _matchLabel: string;
    _matchScore: number;
    _aggregateKey: string;
    sourceCount: number;
    sources: {
        bookUrl: string;
        sourceUrl: string;
        sourceName: string;
        coverUrl: string;
        intro: string;
        kind: string;
        latestChapterTitle: string;
        wordCount: string;
        type: number | undefined;
        _local: boolean;
        _tocVerified: boolean;
        _readable: boolean;
        _matchLevel: LocalMatchLevel;
        _matchLabel: string;
        _matchScore: number;
    }[];
};
//# sourceMappingURL=localBookPriority.d.ts.map