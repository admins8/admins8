export interface BaiduPushConfig {
    site: string;
    token: string;
    enabled: boolean;
    dailyLimit: number;
    maskedToken?: string;
}
export interface BaiduPushResult {
    ok: boolean;
    status: number;
    success: number;
    remain: number | null;
    error: string;
    raw: any;
}
export declare function normalizeBaiduPushConfig(input?: Partial<BaiduPushConfig>): BaiduPushConfig;
export declare function buildBaiduPushEndpoint(site: string, token: string): string;
export declare function pushUrlsToBaidu(config: Partial<BaiduPushConfig>, urls: string[], fetcher?: typeof fetch): Promise<BaiduPushResult>;
export declare function getBaiduPushPluginConfig(): Promise<BaiduPushConfig>;
export declare function saveBaiduPushPluginConfig(config: Partial<BaiduPushConfig>): Promise<BaiduPushConfig>;
export declare function logBaiduPush(urlCount: number, result: BaiduPushResult): Promise<void>;
export declare function pushRecentSitemapUrls(limit?: number): Promise<BaiduPushResult & {
    urlCount: number;
}>;
export declare function listBaiduPushLogs(limit?: number): Promise<any[]>;
//# sourceMappingURL=baiduPushPlugin.d.ts.map