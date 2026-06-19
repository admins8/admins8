export interface GenerateSourceInput {
    url: string;
    name?: string;
    keyword?: string;
    mode?: 'html' | 'api';
    headers?: Record<string, string>;
}
export interface SearchRuleDraft {
    bookList: string;
    name: string;
    author: string;
    bookUrl: string;
    coverUrl?: string;
    intro?: string;
    kind?: string;
    lastChapter?: string;
    wordCount?: string;
}
export interface SearchCandidate {
    template: string;
    url: string;
}
export interface SourceGenerationResult {
    source: any;
    jsonText: string;
    diagnostics: string[];
}
export declare function extractSearchActionTemplate(baseUrl: string, html: string): string | null;
export declare function detectAccessChallenge(html: string): string | null;
export declare function extractApiCandidatesFromHtml(baseUrl: string, html: string): string[];
export declare function inferJsonSearchRule(payload: any): SearchRuleDraft;
export declare function buildSearchCandidates(baseUrl: string, keyword: string, extraTemplates?: string[]): SearchCandidate[];
export declare function inferSearchRulesFromHtml(html: string): SearchRuleDraft;
export declare function buildDefaultSource(input: {
    url: string;
    name: string;
    searchUrl: string;
    ruleSearch: SearchRuleDraft;
}): any;
export declare function buildApiSource(input: {
    url: string;
    name: string;
    searchUrl: string;
    ruleSearch: SearchRuleDraft;
    headers?: Record<string, string>;
}): any;
export declare function buildFallbackGenerationResult(input: {
    url: string;
    name?: string;
    reason?: string;
}): SourceGenerationResult;
export declare function buildHeaderProfiles(url: string, customHeaders?: Record<string, string>): Array<{
    name: string;
    headers: Record<string, string>;
}>;
export declare function generateBookSource(input: GenerateSourceInput): Promise<SourceGenerationResult>;
//# sourceMappingURL=sourceGenerator.d.ts.map