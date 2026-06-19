export interface SiteConfigItem {
    id?: number;
    config_key: string;
    config_value: string;
    description?: string;
}
export declare function getAllSiteConfigs(): Promise<SiteConfigItem[]>;
export declare function getSiteConfigByKey(key: string): Promise<SiteConfigItem | null>;
export declare function upsertSiteConfig(configKey: string, configValue: string): Promise<void>;
export declare function upsertSiteConfigs(configs: Array<{
    config_key: string;
    config_value: string;
}>): Promise<void>;
//# sourceMappingURL=siteConfigRepository.d.ts.map