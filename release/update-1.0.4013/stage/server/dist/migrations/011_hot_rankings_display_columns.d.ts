import type mysql from 'mysql2/promise';
export declare const name = "011_hot_rankings_display_columns";
/**
 * 补齐首页排行榜展示字段。
 *
 * 旧库可能已经执行过 006 迁移，但 hot_rankings 表缺少 intro / cover_url，
 * 会导致首页排行榜接口报错，并连带影响热门搜索、热门标签显示。
 */
export declare function up(db: mysql.Pool): Promise<void>;
//# sourceMappingURL=011_hot_rankings_display_columns.d.ts.map