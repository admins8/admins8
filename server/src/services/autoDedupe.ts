import { query, queryOne, execute, transaction } from '../config/database';

const CONFIG_KEY = 'auto_dedupe_interval_days';

/**
 * 自动去重定时调度器
 * 从 site_config 读取 auto_dedupe_interval_days 配置（天数），
 * 每隔指定天数自动执行一次书籍去重。
 * 设为 0 或空则不执行。
 */
class AutoDedupeScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastRun: Date | null = null;

  /** 启动调度器 */
  async start() {
    const days = await this.getInterval();
    if (days > 0) {
      this.schedule(days);
      console.log(`[自动去重] 已启用，每隔 ${days} 天执行一次`);
    } else {
      console.log('[自动去重] 未启用（间隔天数为 0）');
    }
  }

  /** 重新加载配置并重启 */
  async reload() {
    this.stop();
    const days = await this.getInterval();
    if (days > 0) {
      this.schedule(days);
      console.log(`[自动去重] 已重新配置，每隔 ${days} 天执行一次`);
    } else {
      console.log('[自动去重] 已停止');
    }
  }

  /** 停止调度器 */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 获取配置的间隔天数 */
  private async getInterval(): Promise<number> {
    try {
      const row = await queryOne(
        'SELECT config_value FROM site_config WHERE config_key = ?',
        [CONFIG_KEY]
      );
      const val = Number(row?.config_value || 0);
      return val > 0 ? val : 0;
    } catch {
      return 0;
    }
  }

  /** 设置定时器（天 → 毫秒） */
  private schedule(days: number) {
    const ms = days * 24 * 60 * 60 * 1000;
    this.timer = setInterval(() => this.run(), ms);
  }

  /** 执行自动去重 */
  private async run() {
    try {
      console.log('[自动去重] 开始执行...');
      const result = await this.dedupe();
      console.log(`[自动去重] 完成，删除 ${result.removed} 条重复书籍（${result.groups} 组），清理少于10章 ${result.lowChapterRemoved} 条`);
    } catch (err: any) {
      console.error('[自动去重] 执行失败:', err.message);
    }
  }

  /** 去重核心逻辑（复用 adminController 的逻辑） */
  private async dedupe(): Promise<{ removed: number; groups: number; lowChapterRemoved: number }> {
    // 净化作者字段
    await execute(
      `UPDATE books SET author = TRIM(SUBSTRING(author, 4))
       WHERE author LIKE '作者：%' OR author LIKE '作者:%'`
    );

    let totalRemoved = 0;
    let groups = 0;
    let lowChapterRemoved = 0;

    // 删除章节数少于10章的书籍
    const lowChapterRows = await query(
      `SELECT book_url FROM books WHERE total_chapter_num < 10`
    ) as any[];
    for (const row of lowChapterRows) {
      await transaction(async (conn) => {
        await conn.execute('DELETE FROM book_contents WHERE book_url = ?', [row.book_url]);
        await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [row.book_url]);
        await conn.execute('DELETE FROM user_books WHERE book_url = ?', [row.book_url]);
        await conn.execute('DELETE FROM books WHERE book_url = ?', [row.book_url]);
      });
      lowChapterRemoved++;
    }

    const cleanAuthorSql = `LOWER(TRIM(REPLACE(REPLACE(REPLACE(author, '作者：', ''), '作者:', ''), ' ', '')))`;
    const cleanNameSql = `LOWER(TRIM(REPLACE(name, ' ', '')))`;

    // 有作者的，按书名+作者去重
    const withAuthor = await query(
      `SELECT ANY_VALUE(name) AS name, ANY_VALUE(author) AS author, COUNT(*) AS cnt
       FROM books
       WHERE name IS NOT NULL AND name != '' AND author IS NOT NULL AND author != ''
         AND ${cleanAuthorSql} != ''
       GROUP BY ${cleanNameSql}, ${cleanAuthorSql}
       HAVING cnt > 1`
    ) as any[];

    for (const dup of withAuthor) {
      const keepRow = await queryOne(
        `SELECT id, book_url FROM books
         WHERE ${cleanNameSql} = LOWER(TRIM(REPLACE(?, ' ', '')))
           AND ${cleanAuthorSql} = LOWER(TRIM(REPLACE(REPLACE(REPLACE(?, '作者：', ''), '作者:', ''), ' ', '')))
         ORDER BY total_chapter_num DESC, id ASC LIMIT 1`,
        [dup.name, dup.author]
      );
      if (!keepRow) continue;

      const deleteRows = await query(
        `SELECT book_url FROM books
         WHERE ${cleanNameSql} = LOWER(TRIM(REPLACE(?, ' ', '')))
           AND ${cleanAuthorSql} = LOWER(TRIM(REPLACE(REPLACE(REPLACE(?, '作者：', ''), '作者:', ''), ' ', '')))
           AND id != ?`,
        [dup.name, dup.author, keepRow.id]
      ) as any[];

      for (const row of deleteRows) {
        await transaction(async (conn) => {
          await conn.execute('DELETE FROM book_contents WHERE book_url = ?', [row.book_url]);
          await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [row.book_url]);
          await conn.execute('DELETE FROM user_books WHERE book_url = ?', [row.book_url]);
          await conn.execute('DELETE FROM books WHERE book_url = ?', [row.book_url]);
        });
        totalRemoved++;
      }
      groups++;
    }

    // 无作者的，按书名去重
    const noAuthor = await query(
      `SELECT ANY_VALUE(name) AS name, COUNT(*) AS cnt
       FROM books
       WHERE name IS NOT NULL AND name != '' AND (author IS NULL OR author = '' OR ${cleanAuthorSql} = '')
       GROUP BY ${cleanNameSql}
       HAVING cnt > 1`
    ) as any[];

    for (const dup of noAuthor) {
      const keepRow = await queryOne(
        `SELECT id, book_url FROM books
         WHERE (author IS NULL OR author = '' OR ${cleanAuthorSql} = '')
           AND ${cleanNameSql} = LOWER(TRIM(REPLACE(?, ' ', '')))
         ORDER BY total_chapter_num DESC, id ASC LIMIT 1`,
        [dup.name]
      );
      if (!keepRow) continue;

      const deleteRows = await query(
        `SELECT book_url FROM books
         WHERE (author IS NULL OR author = '' OR ${cleanAuthorSql} = '')
           AND ${cleanNameSql} = LOWER(TRIM(REPLACE(?, ' ', '')))
           AND id != ?`,
        [dup.name, keepRow.id]
      ) as any[];

      for (const row of deleteRows) {
        await transaction(async (conn) => {
          await conn.execute('DELETE FROM book_contents WHERE book_url = ?', [row.book_url]);
          await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [row.book_url]);
          await conn.execute('DELETE FROM user_books WHERE book_url = ?', [row.book_url]);
          await conn.execute('DELETE FROM books WHERE book_url = ?', [row.book_url]);
        });
        totalRemoved++;
      }
      groups++;
    }

    // 第三步：混合情况——同名书籍中，有的有作者、有的没作者，按书名去重
    const mixedAuthor = await query(
      `SELECT ANY_VALUE(name) AS name, COUNT(*) AS cnt
       FROM books
       WHERE name IS NOT NULL AND name != ''
       GROUP BY ${cleanNameSql}
       HAVING cnt > 1`
    ) as any[];

    for (const dup of mixedAuthor) {
      const groupRows = await query(
        `SELECT id, book_url, author, total_chapter_num
         FROM books
         WHERE ${cleanNameSql} = LOWER(TRIM(REPLACE(?, ' ', '')))
         ORDER BY total_chapter_num DESC, id ASC`,
        [dup.name]
      ) as any[];

      if (groupRows.length <= 1) continue;

      const allHaveAuthor = groupRows.every((r: any) => r.author && r.author.trim() !== '');
      const allNoAuthor = groupRows.every((r: any) => !r.author || r.author.trim() === '');
      if (allHaveAuthor || allNoAuthor) continue;

      for (let i = 1; i < groupRows.length; i++) {
        await transaction(async (conn) => {
          await conn.execute('DELETE FROM book_contents WHERE book_url = ?', [groupRows[i].book_url]);
          await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [groupRows[i].book_url]);
          await conn.execute('DELETE FROM user_books WHERE book_url = ?', [groupRows[i].book_url]);
          await conn.execute('DELETE FROM books WHERE book_url = ?', [groupRows[i].book_url]);
        });
        totalRemoved++;
      }
      groups++;
    }

    return { removed: totalRemoved, groups, lowChapterRemoved };
  }
}

export const autoDedupeScheduler = new AutoDedupeScheduler();
