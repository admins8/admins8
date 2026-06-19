import type mysql from 'mysql2/promise';

export const name = '008_book_category_column';

/**
 * 给 books 表增加 category 字段，用于缓存自动识别的书籍分类。
 * - 字段：category VARCHAR(128) DEFAULT ''
 * - 索引：idx_books_category（用于按分类过滤书架/排行榜）
 * 同时把已有的 kind 字段从 "空字符串是 NULL" 统一规范化（不会修改列类型，
 * 仅确保 category 列能与 kind 并存——kind 保留书源原始标签，category 保留落库后的分类）。
 */

async function ensureColumn(db: mysql.Pool, tableName: string, colName: string, ddl: string): Promise<void> {
  const [rows] = await db.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
    [tableName, colName]
  );
  if ((rows as any[]).length > 0) return;
  await db.query(ddl);
}

async function ensureIndex(db: mysql.Pool, tableName: string, indexName: string, ddl: string): Promise<void> {
  const [rows] = await db.query(
    "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
    [tableName, indexName]
  );
  if ((rows as any[]).length > 0) return;
  await db.query(ddl);
}

export async function up(db: mysql.Pool): Promise<void> {
  await ensureColumn(
    db,
    'books',
    'category',
    "ALTER TABLE books ADD COLUMN category VARCHAR(128) DEFAULT ''"
  );
  await ensureIndex(
    db,
    'books',
    'idx_books_category',
    'CREATE INDEX idx_books_category ON books (category)'
  );
}
