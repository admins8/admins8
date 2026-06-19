import { type UrlOption } from './bookSourceHttpClient';
type RequestHtmlFn = (url: string, headers: Record<string, string>, option: UrlOption) => Promise<string>;
interface WebBookEngineOptions extends UrlOption {
    requestHtml?: RequestHtmlFn;
}
export declare function executeRule(rule: string, html: string, isJson?: boolean): string[];
export interface SearchBookResult {
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
}
export interface ChapterResult {
    index: number;
    title: string;
    url: string;
}
export declare class WebBookEngine {
    private readonly requestOptions;
    private headers;
    constructor(requestOptions?: WebBookEngineOptions);
    private withRequestOptions;
    private fetchTargetHtml;
    private normalizeTargetUrl;
    private renderBaseUrlTemplate;
    private extractTocTargetFromBookInfo;
    private initHeaders;
    private buildSearchRequest;
    search(source: any, keyword: string): Promise<SearchBookResult[]>;
    private parseSearchResult;
    private parseMarkdownSearchResult;
    getBookInfo(source: any, bookUrl: string): Promise<Partial<SearchBookResult>>;
    getChapterList(source: any, book: any): Promise<ChapterResult[]>;
    private parseChapterList;
    private parseMarkdownChapterList;
    getContent(source: any, book: any, chapter: any): Promise<string | null>;
    private parseContent;
}
export declare const webBookEngine: WebBookEngine;
export {};
//# sourceMappingURL=webBookService.d.ts.map