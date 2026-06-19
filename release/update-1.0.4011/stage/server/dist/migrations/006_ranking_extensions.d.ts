import type mysql from 'mysql2/promise';
export declare const name = "006_ranking_extensions";
/**
 * 为排行榜表扩展榜单类型与分类字段，支持人气榜、新书榜、点评榜、章节榜、完本榜、字数榜，
 * 以及按分类（玄幻/都市/科幻 等）过滤。
 */
export declare function up(db: mysql.Pool): Promise<void>;
//# sourceMappingURL=006_ranking_extensions.d.ts.map