export interface ReadingSettings {
    guestSearchEnabled: boolean;
    guestReadChapterLimit: number;
}
export declare const DEFAULT_READING_SETTINGS: ReadingSettings;
export declare function parseBooleanConfig(value: unknown, fallback: boolean): boolean;
export declare function parseGuestReadChapterLimit(value: unknown, fallback?: number): number;
export declare function canGuestReadChapter(chapterIndex: number, limit: number): boolean;
export declare function canGuestUseSourceSwitch(chapterIndex: number, limit: number): boolean;
export declare function getReadingSettings(): Promise<ReadingSettings>;
//# sourceMappingURL=readingSettings.d.ts.map