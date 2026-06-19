export interface NormalizedChapter {
    title: string;
    url: string;
    index: number;
    [key: string]: any;
}
export interface NormalizeChapterListOptions {
    dedupeTitle?: boolean;
}
export declare function normalizeChapterList(input: any[], options?: NormalizeChapterListOptions): NormalizedChapter[];
//# sourceMappingURL=chapterListNormalizer.d.ts.map