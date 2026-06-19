export interface SourceDedupeRow {
    id: number;
    book_source_url: string;
}
export declare function normalizeSourceUrlForDedupe(value: string): string;
export declare function findDuplicateSourceIds(rows: SourceDedupeRow[]): number[];
//# sourceMappingURL=sourceDedupe.d.ts.map