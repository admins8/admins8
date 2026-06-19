import { UrlOption } from './bookSourceHttpClient';
export interface CollectorDetailRules {
    name: string;
    author: string;
    coverUrl: string;
    intro: string;
    tocUrl: string;
    kind?: string;
    latestChapterTitle?: string;
}
export interface CollectorTocRules {
    chapterList: string;
    chapterTitle: string;
    chapterUrl: string;
}
export interface CollectorRulePayload {
    id?: number;
    name: string;
    entryUrl: string;
    enabled?: boolean;
    charset?: string;
    headers?: Record<string, string> | string;
    proxy?: string;
    timeoutMs?: number;
    detailRules: CollectorDetailRules;
    tocRules: CollectorTocRules;
    contentRule: string;
}
export interface CollectorBookDraft {
    bookUrl: string;
    tocUrl: string;
    origin: string;
    originName: string;
    name: string;
    author: string;
    coverUrl: string;
    intro: string;
    kind: string;
    latestChapterTitle: string;
}
export interface CollectorChapterDraft {
    index: number;
    title: string;
    url: string;
    content?: string;
}
export interface CollectorRunResult {
    book: CollectorBookDraft;
    chapters: CollectorChapterDraft[];
    imported: boolean;
    chapterCount: number;
    contentCount: number;
}
export interface CollectorRunOptions {
    includeContent?: boolean;
    maxChapters?: number;
    entryUrl?: string;
}
export interface CollectorUpdateCheckResult {
    canUpdate: boolean;
    localChapterCount: number;
    remoteChapterCount: number;
    ruleName: string;
    message: string;
}
export declare function normalizeCollectorRule(input: any): CollectorRulePayload;
export declare function extractBookByCollectorRule(html: string, detailUrl: string, inputRule: CollectorRulePayload): CollectorBookDraft;
export declare function extractChaptersByCollectorRule(html: string, tocUrl: string, inputRule: CollectorRulePayload): CollectorChapterDraft[];
export declare function extractContentByCollectorRule(html: string, inputRule: CollectorRulePayload): string;
export declare function collectorOrigin(url: string): string;
export declare function fetchCollectorChapterContent(originName: string, chapterUrl: string): Promise<string | null>;
export declare function buildCollectorFetchOptions(rule: CollectorRulePayload, parsedOption?: UrlOption): UrlOption;
export declare function listCollectorRules(): Promise<any[]>;
export declare function saveCollectorRule(input: any): Promise<any>;
export declare function deleteCollectorRule(id: number): Promise<void>;
export declare function getCollectorRule(id: number): Promise<CollectorRulePayload>;
export declare function importCollectorRules(payload: any): Promise<{
    success: number;
    fail: number;
    rules: any[];
    errors: string[];
}>;
export declare function exportCollectorRules(): Promise<CollectorRulePayload[]>;
export declare function buildCollectorRunRule(rule: CollectorRulePayload, options?: CollectorRunOptions): CollectorRulePayload;
export declare function buildCollectorUpdateCheck(input: {
    localChapterCount: number;
    remoteChapterCount: number;
    ruleName: string;
}): CollectorUpdateCheckResult;
export interface CollectorTestResult {
    rule: {
        name: string;
        entryUrl: string;
    };
    detail: {
        ok: boolean;
        url: string;
        htmlLength: number;
        book?: CollectorBookDraft;
        error?: string;
    };
    toc: {
        ok: boolean;
        url: string;
        htmlLength: number;
        chapterCount: number;
        chapters: CollectorChapterDraft[];
        error?: string;
    };
    content: {
        ok: boolean;
        url: string;
        htmlLength: number;
        length: number;
        preview?: string;
        error?: string;
    };
    imported: false;
}
export declare function buildCollectorTestFetchError(inputRule: CollectorRulePayload, error: unknown, stage?: 'detail' | 'toc' | 'content'): CollectorTestResult;
export declare function testCollectorRuleFromHtml(inputRule: CollectorRulePayload, pages: {
    detailHtml: string;
    tocHtml?: string;
    contentHtml?: string;
}, context?: {
    detailUrl?: string;
    tocUrl?: string;
    contentUrl?: string;
}): CollectorTestResult;
export declare function testCollectorRule(ruleId: number, options?: {
    entryUrl?: string;
}): Promise<CollectorTestResult>;
export declare function normalizeCollectorChaptersForUpdate(chapters: CollectorChapterDraft[]): CollectorChapterDraft[];
export declare function checkCollectorBookUpdate(bookUrl: string): Promise<CollectorUpdateCheckResult>;
export declare function updateCollectorBookToLatest(bookUrl: string): Promise<CollectorRunResult>;
export declare function buildCollectorUpdateImportBook(currentBookUrl: string, remoteBook: CollectorBookDraft): CollectorBookDraft;
export declare function resolveCollectorMaxChapters(value: unknown): number | undefined;
export declare function runSingleBookCollector(ruleId: number, options?: CollectorRunOptions): Promise<CollectorRunResult>;
export declare function importCollectedBook(book: CollectorBookDraft, chapters: CollectorChapterDraft[]): Promise<void>;
//# sourceMappingURL=collectorPlugin.d.ts.map