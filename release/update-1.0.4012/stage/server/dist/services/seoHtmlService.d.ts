export type SiteConfigMap = Record<string, string>;
export type SeoVars = Record<string, string | number | undefined | null>;
export interface RouteSeo {
    title: string;
    keywords: string;
    description: string;
    canonical: string;
}
export declare function escapeHtml(value: string): string;
export declare function escapeJsonForHtml(value: SiteConfigMap): string;
export declare function loadSiteConfigMap(): Promise<SiteConfigMap>;
export declare function renderSeoTemplate(template: string, configs: SiteConfigMap, vars?: SeoVars): string;
export declare function buildRouteSeo(requestUrl: string, configs: SiteConfigMap, extraVars?: SeoVars): RouteSeo;
export declare function injectSeoIntoHtml(html: string, configs: SiteConfigMap, seo: RouteSeo): string;
export declare function renderFrontendHtml(indexPath: string, requestUrl: string): Promise<string>;
export declare function syncStaticSeoShells(webDistPath: string): Promise<void>;
//# sourceMappingURL=seoHtmlService.d.ts.map