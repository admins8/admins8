import type mysql from 'mysql2/promise';

export const name = '022_search_concurrency_default_20';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query(`
    UPDATE site_config
    SET config_value = '20'
    WHERE config_key = 'search_source_concurrency'
      AND config_value = '10'
  `);
}
