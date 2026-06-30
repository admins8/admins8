import type mysql from 'mysql2/promise';

export const name = '033_collector_resume';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query(`
    ALTER TABLE collector_rules
    ADD COLUMN IF NOT EXISTS last_progress TEXT DEFAULT NULL
  `);
}
