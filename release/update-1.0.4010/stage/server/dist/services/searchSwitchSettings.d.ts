export interface SearchSwitchSettings {
    searchVerifyToc: boolean;
    searchSourceConcurrency: number;
    searchSourceTimeoutMs: number;
    searchTocTimeoutMs: number;
    sourceSwitchConcurrency: number;
    sourceSwitchTimeoutMs: number;
    sourceSwitchTocTimeoutMs: number;
    alternateSourceCacheTtlSeconds: number;
    searchRequestUserAgents: string;
    searchRequestProxy: string;
}
export declare const SEARCH_SWITCH_DEFAULTS: SearchSwitchSettings;
export declare function normalizeSearchSwitchSettings(configMap: Record<string, unknown>): SearchSwitchSettings;
export declare function getSearchSwitchSettings(): Promise<SearchSwitchSettings>;
//# sourceMappingURL=searchSwitchSettings.d.ts.map