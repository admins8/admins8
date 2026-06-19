import type mysql from 'mysql2/promise';

export const name = '023_reference_thread_count_concurrency';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query(`
    UPDATE site_config
    SET config_value = '16'
    WHERE config_key IN ('search_source_concurrency', 'source_switch_concurrency')
      AND config_value IN ('20', '10')
  `);
}
