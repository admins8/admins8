import type { ChapterResult } from './webBookService';
export interface ChapterListEngine {
    getChapterList(source: any, book: any): Promise<ChapterResult[]>;
}
export declare function isUsableChapter(chapter: any): boolean;
/**
 * 判断书源返回的书籍是否具备有效章节（至少 10 条非空章节标题）。
 * 不足 10 章的书源结果将被跳过，不返回给前端，避免展示无内容的匹配。
 */
export declare function hasAvailableChapters(engine: ChapterListEngine, source: any, book: any, timeoutMs?: number, minChapters?: number): Promise<boolean>;
//# sourceMappingURL=sourceAvailability.d.ts.map