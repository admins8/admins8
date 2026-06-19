export interface ChannelPayload {
    name?: string;
    path?: string;
    compat_path?: string | null;
    seo_title?: string | null;
    seo_keywords?: string | null;
    seo_description?: string | null;
    is_active?: boolean | number;
    sort_order?: number;
}
export interface SectionPayload {
    section_code?: string;
    title?: string;
    display_type?: string;
    more_link?: string | null;
    sort_order?: number;
    is_active?: boolean | number;
}
export interface ItemPayload {
    title?: string;
    author?: string | null;
    cover_url?: string | null;
    intro?: string | null;
    category?: string | null;
    word_count?: string | null;
    latest_chapter?: string | null;
    link_url?: string | null;
    sort_order?: number;
    is_active?: boolean | number;
}
export declare function getPublicChannel(code: string): Promise<any>;
export declare function getAdminChannel(code: string): Promise<any>;
export declare function seedChannel(code: string): Promise<any>;
export declare function updateChannel(code: string, payload: ChannelPayload): Promise<any>;
export declare function createSection(code: string, payload: SectionPayload): Promise<any>;
export declare function updateSection(id: number, payload: SectionPayload): Promise<any>;
export declare function deleteSection(id: number): Promise<{
    id: number;
}>;
export declare function createItem(sectionId: number, payload: ItemPayload): Promise<any>;
export declare function updateItem(id: number, payload: ItemPayload): Promise<any>;
export declare function deleteItem(id: number): Promise<{
    id: number;
}>;
//# sourceMappingURL=pageChannelService.d.ts.map