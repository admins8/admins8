import type mysql from 'mysql2/promise';
export declare const name = "012_content_cleaner_english_noise";
/**
 * 为已有站点配置追加常见英文广告/站点提示行净化规则。
 *
 * 旧库已经存在 content_cleaner_rules 时，INSERT IGNORE 不会覆盖旧值，
 * 所以这里做一次兼容性合并，保留用户自定义规则并追加新增默认规则。
 */
export declare function up(db: mysql.Pool): Promise<void>;
//# sourceMappingURL=012_content_cleaner_english_noise.d.ts.map