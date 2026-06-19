import type mysql from 'mysql2/promise';

export const name = '024_search_switch_concurrency_default_50';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query(`
    UPDATE site_config
    SET config_value = '50'
    WHERE config_key IN ('search_source_concurrency', 'source_switch_concurrency')
      AND config_value IN ('10', '16', '20', '24', '32')
  `);
}
