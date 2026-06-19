import type mysql from 'mysql2/promise';

export const name = '023_user_last_login_at';

async function ensureColumn(db: mysql.Pool, tableName: string, colName: string, ddl: string): Promise<void> {
  const [rows] = await db.query(
    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [tableName, colName]
  );
  if ((rows as any[]).length > 0) return;
  await db.query(ddl);
}

export async function up(db: mysql.Pool): Promise<void> {
  await ensureColumn(
    db,
    'users',
    'last_login_at',
    'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL AFTER created_at'
  );
}
