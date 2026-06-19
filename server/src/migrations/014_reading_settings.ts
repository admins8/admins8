import type mysql from 'mysql2/promise';

export const name = '014_reading_settings';

/**
 * 增加后台阅读设置：
 * - guest_search_enabled：未登录用户是否允许搜索
 * - guest_read_chapter_limit：未登录用户可阅读章节数，-1 表示不限，0 表示不可读
 */
export async function up(db: mysql.Pool): Promise<void> {
  await db.query(
    `INSERT IGNORE INTO site_config (config_key, config_value, description) VALUES
      ('guest_search_enabled', '1', '未登录用户是否允许搜索书籍'),
      ('guest_read_chapter_limit', '3', '未登录用户可阅读的章节数量，-1 表示不限，0 表示不可阅读')`
  );
}
