import type mysql from 'mysql2/promise';
export declare const name = "014_reading_settings";
/**
 * 增加后台阅读设置：
 * - guest_search_enabled：未登录用户是否允许搜索
 * - guest_read_chapter_limit：未登录用户可阅读章节数，-1 表示不限，0 表示不可读
 */
export declare function up(db: mysql.Pool): Promise<void>;
//# sourceMappingURL=014_reading_settings.d.ts.map