/**
 * 排行榜业务逻辑：榜单类型常量、分类（从 book_categories 表动态加载）、规范化、根据用户阅读数据自动构建榜单。
 *
 * 共有 6 类榜单：
 *  - popularity: 人气榜（按 readers/download_count 降序）
 *  - new:        新书榜（按最新章节时间降序）
 *  - review:     点评榜（按 review_count 降序）
 *  - chapter:    章节榜（按 chapter_count 降序）
 *  - complete:   完本榜（仅 is_complete=1，按 readers 降序）
 *  - wordcount:  字数榜（按 word_count 降序）
 */
export interface RankTypeMeta {
    code: string;
    label: string;
    metricLabel: string;
}
export declare const RANK_TYPES: RankTypeMeta[];
export declare function getActiveCategories(forceRefresh?: boolean): Promise<string[]>;
export declare function getCachedCategories(): string[];
export declare function refreshCategoriesCache(): Promise<string[]>;
export declare function isValidRankType(code: string | undefined | null): boolean;
export declare function isValidCategory(name: string | undefined | null): boolean;
export interface RankingRecord {
    name: string;
    author: string;
    cover_url: string;
    intro: string;
    book_url: string;
    rank_type: string;
    category: string;
    download_count: number;
    rating: number;
    review_count: number;
    chapter_count: number;
    word_count: number;
    is_complete: number;
    extra: string;
    sort_order: number;
    is_active: number;
}
/**
 * 规范化外部传入的榜单写入数据：trim 名称、限制取值范围、未知字段使用默认值。
 */
export declare function normalizeRankingInput(input: Partial<RankingRecord> & Record<string, any>): RankingRecord;
export interface AutoRankingBookSeed {
    name: string;
    author?: string;
    coverUrl?: string;
    intro?: string;
    kind?: string;
    bookUrl?: string;
    readers: number;
    reviews?: number;
    chapterCount?: number;
    wordCount?: number;
    isComplete?: number | boolean;
    latestChapterTime?: string;
}
export interface AutoRankingResult {
    popularity: RankingRecord[];
    new: RankingRecord[];
    review: RankingRecord[];
    chapter: RankingRecord[];
    complete: RankingRecord[];
    wordcount: RankingRecord[];
}
/**
 * 根据书源返回的 kind / 书名 / 简介，智能识别出最匹配的后台分类。
 * 匹配优先级（从高到低）：
 *   1. kind 里直接包含后台分类名称（最准确，书源明确标注）
 *   2. 书名里直接包含后台分类名称（"XX玄幻之..."）
 *   3. 根据关键词映射表匹配（kind / name / intro 任一字段命中）
 *   4. 简介里包含后台分类名称（最弱，用于兜底）
 *   5. 全部失败 → 返回 "全部"
 *
 * @param info.kind    书源返回的类型标签（如 "玄幻/奇幻/连载"）
 * @param info.name    书名
 * @param info.intro   简介
 */
export declare function autoDetectCategory(info: {
    kind?: string | null;
    name?: string | null;
    intro?: string | null;
}): string;
/** 兼容旧签名：pickCategory(kind) 等价于只传 kind 的简化调用 */
export declare function pickCategory(kind: string | undefined): string;
/**
 * 根据用户阅读数据生成 6 类榜单。每类最多取前 20 条。
 */
export declare function buildAutoRankingsFromBooks(seeds: AutoRankingBookSeed[], limitPerRank?: number): AutoRankingResult;
/**
 * 规范化作者字段，用于去重比较和写入数据库前的清洗。
 * 书源返回的 author 可能是 "忘语" / "作者：忘语" / "作者: 忘语" / "作者-忘语" 等。
 * 同时过滤掉明显的脏数据（如多段内容、超过正常长度、或者包含换行的章节标题）。
 */
export declare function normalizeAuthor(raw: string | undefined | null): string;
/**
 * 规范化书名，用于去重比较。
 * - 去除全角/半角书名号、空格
 * - 去除常见"（XXX）"、"(XXX)" 的副标题（仅作为去重比对用，不改原始数据）
 */
export declare function normalizeBookName(raw: string | undefined | null): string;
/**
 * 对榜单书籍按"书名+作者"去重，保留排序最靠前的那一条。
 * 规范化：
 *  - 书名去书名号/括号/空白，统一小写
 *  - 作者去"作者："前缀、去空白，统一小写；明显脏数据（超长/换行）视为空
 *  - 若书名相同但一条作者为空一条非空，保留有作者的那条
 */
export declare function dedupeRankingItems<T extends {
    name?: string;
    author?: string;
    [key: string]: any;
}>(items: T[]): T[];
//# sourceMappingURL=rankingService.d.ts.map