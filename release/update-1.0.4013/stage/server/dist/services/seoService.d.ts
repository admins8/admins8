export interface SitemapUrl {
    loc: string;
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
}
export declare function buildSeoBookSlug(book: {
    id?: number | string;
    name?: string;
    author?: string;
}): string;
export declare function buildSeoBookUrl(domain: string, book: {
    id?: number | string;
    name?: string;
    author?: string;
}): string;
export declare function buildRobotsTxt(domain: string): string;
export declare function buildSitemapXml(urls: SitemapUrl[]): string;
export declare function getSeoDomain(): Promise<string>;
export declare function collectSitemapUrls(domain?: string, limit?: number): Promise<SitemapUrl[]>;
//# sourceMappingURL=seoService.d.ts.map