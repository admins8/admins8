import { AxiosRequestConfig } from 'axios';
export interface UrlOption {
    method?: string;
    charset?: string;
    headers?: Record<string, string>;
    body?: string;
    webView?: any;
    js?: string;
    type?: string;
    retry?: number;
    proxy?: string;
    timeoutMs?: number;
    simulatedUserAgents?: string[];
    forceRandomUserAgent?: boolean;
    targetAccessMode?: 'direct' | 'snapshot-fallback' | 'snapshot-first';
}
export interface SearchRequestOptionSettings {
    searchRequestUserAgents?: string;
    searchRequestProxy?: string;
}
export interface ProxyConnectionTestInput {
    proxy?: string;
    userAgents?: string;
    targetUrl?: string;
}
export interface ProxyConnectionTestResult {
    ok: boolean;
    proxy: string;
    targetUrl: string;
    status?: number;
    elapsedMs?: number;
    outboundIp?: string;
    userAgent?: string;
    error?: string;
    message?: string;
}
export interface ProxyPoolTestResult {
    ok: boolean;
    total: number;
    available: number;
    results: ProxyConnectionTestResult[];
}
export declare const DEFAULT_RANDOM_USER_AGENTS: string[];
export declare function parseUserAgentList(value: string | undefined | null): string[];
export declare function pickRandomUserAgent(userAgents?: string[]): string;
export declare function parseProxyList(value: string): string[];
export declare function normalizeProxyUrl(proxy: string): string | undefined;
export declare function pickRandomProxy(proxies?: string[]): string | undefined;
export declare function buildSearchRequestOptions(settings: SearchRequestOptionSettings): UrlOption;
export declare function parseProxyConfig(proxy: string): AxiosRequestConfig['proxy'];
export declare function testSearchProxyConnection(input: ProxyConnectionTestInput): Promise<ProxyConnectionTestResult>;
export declare function testSearchProxyPool(input: ProxyConnectionTestInput): Promise<ProxyPoolTestResult>;
export declare function parseLooseObjectLiteral(input: string): any;
export declare function buildHeaders(sourceHeader: string | null): Record<string, string>;
export declare function buildRequestHeaders(url: string, headers: Record<string, string>, optionHeaders?: Record<string, string>): Record<string, string>;
export declare function buildRetryHeaderProfiles(url: string, headers: Record<string, string>, optionHeaders?: Record<string, string>): Array<{
    name: string;
    headers: Record<string, string>;
}>;
export declare function parseSearchUrl(raw: string): {
    url: string;
    option: UrlOption;
};
export declare function resolveScriptSearchUrl(rawSearchUrl: string, baseUrl?: string): string;
export declare function httpRequest(url: string, headers: Record<string, string>, option?: UrlOption): Promise<string>;
//# sourceMappingURL=bookSourceHttpClient.d.ts.map