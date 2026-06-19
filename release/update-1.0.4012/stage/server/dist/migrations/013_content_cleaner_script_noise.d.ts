import type mysql from 'mysql2/promise';
export declare const name = "013_content_cleaner_script_noise";
/**
 * 为已有站点追加脚本变量残留净化规则，例如阅读正文中的 window.fkp = "base64..."。
 */
export declare function up(db: mysql.Pool): Promise<void>;
//# sourceMappingURL=013_content_cleaner_script_noise.d.ts.map