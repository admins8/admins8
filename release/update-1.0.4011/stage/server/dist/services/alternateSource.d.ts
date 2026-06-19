import type { SearchBookResult } from './webBookService';
export declare function isCurrentReadingSource(source: any, book: any, matched: SearchBookResult): boolean;
export declare function buildAlternateSourceResult(matched: SearchBookResult, source: any, book: any): {
    sourceUrl: any;
    sourceName: any;
    matchScore: number;
    isCurrentSource: boolean;
    name: string;
    author: string;
    bookUrl: string;
    tocUrl?: string;
    coverUrl: string;
    intro: string;
    kind: string;
    latestChapterTitle: string;
    wordCount: string;
    origin: string;
    originName: string;
    type: number;
};
//# sourceMappingURL=alternateSource.d.ts.map