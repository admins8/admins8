import type mysql from 'mysql2/promise';

export const name = '015_seo_config_templates';

/**
 * 增加统一 SEO 配置字段，支持首页、详情页、阅读页、搜索页、排行榜页。
 * 模板支持 {年份}，由前端和 HTML 注入逻辑按当前年份渲染。
 */
export async function up(db: mysql.Pool): Promise<void> {
  await db.query(
    `INSERT IGNORE INTO site_config (config_key, config_value, description) VALUES
      ('reader_title_template', '{chapterTitle}_{bookName}全文阅读_{siteName}', '阅读页标题模板'),
      ('reader_keywords_template', '{bookName},{chapterTitle},{author},免费阅读,{年份}', '阅读页关键词模板'),
      ('reader_description_template', '正在阅读{bookName}的{chapterTitle}，作者：{author}。', '阅读页描述模板'),
      ('search_title_template', '{keyword}搜索结果_{siteName}', '搜索页标题模板'),
      ('search_keywords_template', '{keyword},小说搜索,免费小说,{年份}', '搜索页关键词模板'),
      ('search_description_template', '在{siteName}搜索{keyword}，查看相关小说和可用书源。', '搜索页描述模板'),
      ('ranking_title_template', '小说排行榜_{siteName}', '排行榜页标题模板'),
      ('ranking_keywords_template', '小说排行榜,热门小说,完本小说,免费小说,{年份}', '排行榜页关键词模板'),
      ('ranking_description_template', '{siteName}提供热门小说排行榜、分类榜单和推荐书单。', '排行榜页描述模板')`
  );
}
