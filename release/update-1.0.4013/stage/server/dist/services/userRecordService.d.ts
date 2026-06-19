export type UserRecordType = 'reading' | 'searches' | 'comments' | 'likes' | 'favorites' | 'checkins';
export declare const USER_RECORD_TYPES: UserRecordType[];
interface UserRecordConfig {
    title: string;
    table: string;
    timeColumn: string;
    searchableBook?: boolean;
}
export declare function getUserRecordConfig(type: string): UserRecordConfig;
export declare function buildUserRecordPagination(input: any): {
    page: number;
    size: number;
    offset: number;
};
export declare function listUserRecords(type: string, input: any): Promise<{
    list: any[];
    total: any;
    page: number;
    size: number;
}>;
export declare function recordUserSearch(input: {
    userId?: number | null;
    keyword: string;
    resultCount?: number;
    ipAddress?: string;
}): Promise<void>;
export {};
//# sourceMappingURL=userRecordService.d.ts.map