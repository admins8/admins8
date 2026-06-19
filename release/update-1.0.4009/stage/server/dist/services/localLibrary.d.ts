export interface LocalLibraryQuery {
    keyword: string;
    category: string;
    page: number;
    pageSize: number;
    offset: number;
}
export declare function normalizeLocalLibraryQuery(input: Record<string, unknown>): LocalLibraryQuery;
export declare function buildLocalLibraryWhere(keyword: string, category?: string): {
    where: string;
    params: any[];
};
export declare function normalizeLocalLibraryIdentityKey(book: any): string;
export declare function dedupeLocalLibraryBooks<T extends Record<string, any>>(rows: T[]): T[];
//# sourceMappingURL=localLibrary.d.ts.map