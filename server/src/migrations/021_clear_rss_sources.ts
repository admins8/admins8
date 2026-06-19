import type mysql from 'mysql2/promise';

export const name = '021_clear_rss_sources';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query('DELETE FROM rss_sources');
}
