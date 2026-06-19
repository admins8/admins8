import type mysql from 'mysql2/promise';

export const name = '011_hot_rankings_display_columns';

/**
 * 补齐首页排行榜展示字段。
 *
 * 旧库可能已经执行过 006 迁移，但 hot_rankings 表缺少 intro / cover_url，
 * 会导致首页排行榜接口报错，并连带影响热门搜索、热门标签显示。
 */
export async function up(db: mysql.Pool): Promise<void> {
  const columns: Array<{ name: string; ddl: string }> = [
    {
      name: 'intro',
      ddl: 'ADD COLUMN intro TEXT DEFAULT NULL',
    },
    {
      name: 'cover_url',
      ddl: "ADD COLUMN cover_url VARCHAR(500) DEFAULT ''",
    },
  ];

  for (const col of columns) {
    const [rows] = await db.query<any[]>(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'hot_rankings'
         AND COLUMN_NAME = ?`,
      [col.name]
    );
    const exists = (rows as any[])[0]?.cnt > 0;
    if (!exists) {
      await db.query(`ALTER TABLE hot_rankings ${col.ddl}`);
    }
  }
}
