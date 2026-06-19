import type mysql from 'mysql2/promise';
import { defaultContentCleanerRules, normalizeContentCleanerRules } from '../services/contentCleaner';

export const name = '013_content_cleaner_script_noise';

/**
 * 为已有站点追加脚本变量残留净化规则，例如阅读正文中的 window.fkp = "base64..."。
 */
export async function up(db: mysql.Pool): Promise<void> {
  const [rows] = await db.query<any[]>(
    'SELECT config_value FROM site_config WHERE config_key = ? LIMIT 1',
    ['content_cleaner_rules']
  );

  const current = normalizeContentCleanerRules(rows[0]?.config_value || null);
  const mergedPatterns = [...(current.removePatterns || [])];

  for (const pattern of defaultContentCleanerRules.removePatterns || []) {
    if (!mergedPatterns.includes(pattern)) {
      mergedPatterns.push(pattern);
    }
  }

  await db.query(
    `INSERT INTO site_config (config_key, config_value, description)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       config_value = VALUES(config_value),
       description = VALUES(description)`,
    [
      'content_cleaner_rules',
      JSON.stringify({ ...current, removePatterns: mergedPatterns }),
      '正文净化规则',
    ]
  );
}
