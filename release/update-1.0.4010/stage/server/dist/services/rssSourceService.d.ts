export type RssSourceUrlType = 'single' | 'collection' | 'unknown';
export interface NormalizedRssSource {
    sourceUrl: string;
    sourceName: string;
    sourceGroup: string | null;
    sourceIcon: string | null;
    sourceComment: string | null;
    enabled: boolean;
    customOrder: number;
    articleStyle: number;
    singleUrl: boolean;
    enableJs: boolean;
    enabledCookieJar: boolean;
    header: string | null;
    sortUrl: string | null;
    ruleArticles: string | null;
    ruleTitle: string | null;
    ruleLink: string | null;
    ruleImage: string | null;
    rulePubDate: string | null;
    ruleContent: string | null;
    ruleNextPage: string | null;
    rawJson: string;
}
export declare function detectRssSourceUrlType(url: string): RssSourceUrlType;
export declare function normalizeRssImportPayload(payload: unknown): any[];
export declare function normalizeRssSourceInput(input: any): NormalizedRssSource;
export declare function upsertRssSources(inputs: any[]): Promise<{
    success: boolean;
    name: string;
    error?: string;
}[]>;
export declare function importRssSourcesFromUrl(url: string): Promise<{
    success: number;
    fail: number;
    results: {
        success: boolean;
        name: string;
        error?: string;
    }[];
}>;
export declare function listRssSources(): Promise<any[]>;
export declare function getRssSource(id: number): Promise<any>;
export declare function updateRssSource(id: number, payload: any): Promise<void>;
export declare function deleteRssSources(ids: number[]): Promise<void>;
export declare function listRssArticles(id: number, sortUrl?: string): Promise<{
    source: any;
    items: {
        index: number;
        title: string;
        link: string;
        image: string;
        pubDate: string;
    }[];
}>;
export declare function getRssArticleContent(id: number, link: string): Promise<{
    source: any;
    link: string;
    content: string;
}>;
//# sourceMappingURL=rssSourceService.d.ts.map