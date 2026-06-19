export interface SiteConfigLike {
    config_key: string;
    config_value: string;
    [key: string]: any;
}
export declare const PUBLIC_SITE_CONFIG_KEYS: Set<string>;
export declare function isPublicSiteConfigKey(key: string): boolean;
export declare function filterPublicSiteConfigs<T extends SiteConfigLike>(items: T[]): T[];
export declare function filterPublicSiteConfigMap(map: Record<string, string>): Record<string, string>;
//# sourceMappingURL=publicSiteConfig.d.ts.map