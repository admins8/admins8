import type mysql from 'mysql2/promise';

export const name = '006_ranking_extensions';

/**
 * 为排行榜表扩展榜单类型与分类字段，支持人气榜、新书榜、点评榜、章节榜、完本榜、字数榜，
 * 以及按分类（玄幻/都市/科幻 等）过滤。
 */
export async function up(db: mysql.Pool): Promise<void> {
  const columns: Array<{ name: string; ddl: string }> = [
    {
      name: 'rank_type',
      ddl:
        "ADD COLUMN rank_type VARCHAR(32) NOT NULL DEFAULT 'popularity' COMMENT '榜单类型: popularity/new/review/chapter/complete/wordcount'",
    },
    {
      name: 'category',
      ddl:
        "ADD COLUMN category VARCHAR(64) NOT NULL DEFAULT '全部' COMMENT '榜单分类: 全部/玄幻/奇幻/武侠/仙侠/都市/历史/军事/游戏/体育/科幻/悬疑/同人/其他'",
    },
    {
      name: 'review_count',
      ddl: "ADD COLUMN review_count INT NOT NULL DEFAULT 0 COMMENT '点评数量'",
    },
    {
      name: 'chapter_count',
      ddl: "ADD COLUMN chapter_count INT NOT NULL DEFAULT 0 COMMENT '章节数'",
    },
    {
      name: 'word_count',
      ddl: "ADD COLUMN word_count INT NOT NULL DEFAULT 0 COMMENT '字数(万)'",
    },
    {
      name: 'is_complete',
      ddl: 'ADD COLUMN is_complete TINYINT(1) NOT NULL DEFAULT 0 COMMENT \'是否完本\'',
    },
    {
      name: 'extra',
      ddl: "ADD COLUMN extra VARCHAR(200) NOT NULL DEFAULT '' COMMENT '榜单展示的辅助信息'",
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

  // 索引：按 rank_type + category 检索
  const [idxRows] = await db.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'hot_rankings'
       AND INDEX_NAME = 'idx_ranking_type_category'`
  );
  if ((idxRows as any[])[0]?.cnt === 0) {
    await db.query(
      'ALTER TABLE hot_rankings ADD INDEX idx_ranking_type_category (rank_type, category, sort_order)'
    );
  }
}
