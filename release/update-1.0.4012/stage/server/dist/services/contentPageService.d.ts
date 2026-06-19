export declare const STATIC_PAGE_DEFAULTS: {
    slug: string;
    title: string;
    content: string;
}[];
export declare function normalizeContentPagePayload(payload: any): {
    title: string;
    content: string;
    is_active: number;
    seo_title: string;
    seo_keywords: string;
    seo_description: string;
};
export declare function listContentPages(): Promise<any[]>;
export declare function getAdminContentPage(slug: string): Promise<any>;
export declare function getPublicContentPage(slug: string): Promise<any>;
export declare function updateContentPage(slug: string, payload: any): Promise<any>;
//# sourceMappingURL=contentPageService.d.ts.map