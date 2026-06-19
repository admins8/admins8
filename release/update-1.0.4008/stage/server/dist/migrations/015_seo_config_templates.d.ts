import type mysql from 'mysql2/promise';
export declare const name = "015_seo_config_templates";
/**
 * 增加统一 SEO 配置字段，支持首页、详情页、阅读页、搜索页、排行榜页。
 * 模板支持 {年份}，由前端和 HTML 注入逻辑按当前年份渲染。
 */
export declare function up(db: mysql.Pool): Promise<void>;
//# sourceMappingURL=015_seo_config_templates.d.ts.map