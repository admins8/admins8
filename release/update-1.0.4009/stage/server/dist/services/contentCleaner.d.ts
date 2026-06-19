export interface ContentCleanerReplacement {
    pattern: string;
    replacement?: string;
    flags?: string;
}
export interface ContentCleanerRules {
    removeTags?: string[];
    removeTexts?: string[];
    removePatterns?: string[];
    replacements?: ContentCleanerReplacement[];
}
export declare const defaultContentCleanerRules: ContentCleanerRules;
export declare function normalizeContentCleanerRules(input?: string | ContentCleanerRules | null): ContentCleanerRules;
export declare function cleanContent(content: string, customRules?: string | ContentCleanerRules | null): string;
//# sourceMappingURL=contentCleaner.d.ts.map