export interface FriendlyLinkRow {
    id: number;
    name: string;
    url: string;
    description?: string | null;
    sort_order: number;
    is_active: number;
    start_at?: string | Date | null;
    end_at?: string | Date | null;
}
export declare function normalizeFriendlyLinkPayload(payload: any): {
    name: string;
    url: string;
    description: string;
    sort_order: number;
    is_active: number;
    start_at: string | null;
    end_at: string | null;
};
export declare function filterVisibleFriendlyLinks<T extends FriendlyLinkRow>(links: T[], enabled: boolean, now?: Date): T[];
export declare function listFriendlyLinks(): Promise<any[]>;
export declare function getPublicFriendlyLinks(): Promise<FriendlyLinkRow[]>;
export declare function getFriendlyLinkSettings(): Promise<{
    enabled: boolean;
}>;
export declare function updateFriendlyLinkSettings(enabled: boolean): Promise<{
    enabled: boolean;
}>;
export declare function createFriendlyLink(payload: any): Promise<any>;
export declare function updateFriendlyLink(id: number, payload: any): Promise<any>;
export declare function deleteFriendlyLink(id: number): Promise<boolean>;
//# sourceMappingURL=friendlyLinkService.d.ts.map