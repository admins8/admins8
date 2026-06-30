import { Request, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { RANK_TYPES, getActiveCategories, dedupeRankingItems, buildAutoRankingsFromBooks, type AutoRankingBookSeed } from '../services/rankingService';
import { normalizeLocalLibraryQuery, buildLocalLibraryWhere, dedupeLocalLibraryBooks } from '../services/localLibrary';

// ========== 热门搜索 ==========

export async function getHotSearches(req: Request, res: Response): Promise<void> {
  try {
    const items = await query(
      'SELECT id, name, count, tag_type, sort_order, is_active FROM hot_searches WHERE is_active = 1 ORDER BY sort_order ASC, count DESC'
    );
    res.json({ code: 0, data: items });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function getAllHotSearches(req: Request, res: Response): Promise<void> {
  try {
    const items = await query('SELECT * FROM hot_searches ORDER BY sort_order ASC, created_at DESC');
    res.json({ code: 0, data: items });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function addHotSearch(req: Request, res: Response): Promise<void> {
  try {
    const { name, count, tag_type, sort_order } = req.body;
    const result = await execute(
      'INSERT INTO hot_searches (name, count, tag_type, sort_order) VALUES (?, ?, ?, ?)',
      [name, count || 0, tag_type || 'primary', sort_order || 0]
    );
    res.json({ code: 0, data: { id: result.insertId } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function updateHotSearch(req: Request, res: Response): Promise<void> {
  try {
    const { id, name, count, tag_type, sort_order, is_active } = req.body;
    if (!id) {
      res.json({ code: 400, msg: '缺少id参数' });
      return;
    }
    await execute(
      'UPDATE hot_searches SET name = ?, count = ?, tag_type = ?, sort_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [name, count, tag_type, sort_order, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]
    );
    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function deleteHotSearch(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.body;
    if (!id) {
      res.json({ code: 400, msg: '缺少id参数' });
      return;
    }
    await execute('DELETE FROM hot_searches WHERE id = ?', [id]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 热门排行榜 ==========

export async function getHotRankings(req: Request, res: Response): Promise<void> {
  try {
    const rankType = String(req.query.type || '').trim();
    let sql = 'SELECT id, name, book_url, author, download_count, rating, sort_order, intro, cover_url FROM hot_rankings WHERE is_active = 1';
    const params: any[] = [];
    if (rankType) {
      sql += ' AND rank_type = ?';
      params.push(rankType);
    }
    sql += ' ORDER BY sort_order ASC, download_count DESC';
    const items = await query(sql, params);
    // 按 name+author 去重，同名同作者只保留第一条
    const seen = new Set<string>();
    const deduped = (items as any[]).filter((item: any) => {
      const key = `${String(item.name || '').trim()}|${String(item.author || '').trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    res.json({ code: 0, data: deduped });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function getAllHotRankings(req: Request, res: Response): Promise<void> {
  try {
    const items = await query('SELECT * FROM hot_rankings ORDER BY sort_order ASC, created_at DESC');
    res.json({ code: 0, data: items });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function addHotRanking(req: Request, res: Response): Promise<void> {
  try {
    const { name, book_url, author, download_count, rating, sort_order, intro, cover_url } = req.body;
    const result = await execute(
      'INSERT INTO hot_rankings (name, book_url, author, download_count, rating, sort_order, intro, cover_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, book_url || '', author || '', download_count || 0, rating || 0, sort_order || 0, intro || '', cover_url || '']
    );
    res.json({ code: 0, data: { id: result.insertId } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function updateHotRanking(req: Request, res: Response): Promise<void> {
  try {
    const { id, name, book_url, author, download_count, rating, sort_order, is_active, intro, cover_url } = req.body;
    if (!id) {
      res.json({ code: 400, msg: '缺少id参数' });
      return;
    }
    await execute(
      'UPDATE hot_rankings SET name = ?, book_url = ?, author = ?, download_count = ?, rating = ?, sort_order = ?, is_active = ?, intro = ?, cover_url = ?, updated_at = NOW() WHERE id = ?',
      [name, book_url, author, download_count, rating, sort_order, is_active !== undefined ? (is_active ? 1 : 0) : 1, intro || '', cover_url || '', id]
    );
    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function deleteHotRanking(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.body;
    if (!id) {
      res.json({ code: 400, msg: '缺少id参数' });
      return;
    }
    await execute('DELETE FROM hot_rankings WHERE id = ?', [id]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 热门标签 ==========

export async function getHotTags(req: Request, res: Response): Promise<void> {
  try {
    const items = await query(
      'SELECT id, name, sort_order FROM hot_tags WHERE is_active = 1 ORDER BY sort_order ASC, name ASC'
    );
    res.json({ code: 0, data: items });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function getAllHotTags(req: Request, res: Response): Promise<void> {
  try {
    const items = await query('SELECT * FROM hot_tags ORDER BY sort_order ASC, created_at DESC');
    res.json({ code: 0, data: items });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function addHotTag(req: Request, res: Response): Promise<void> {
  try {
    const { name, sort_order } = req.body;
    const result = await execute(
      'INSERT INTO hot_tags (name, sort_order) VALUES (?, ?)',
      [name, sort_order || 0]
    );
    res.json({ code: 0, data: { id: result.insertId } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function updateHotTag(req: Request, res: Response): Promise<void> {
  try {
    const { id, name, sort_order, is_active } = req.body;
    if (!id) {
      res.json({ code: 400, msg: '缺少id参数' });
      return;
    }
    await execute(
      'UPDATE hot_tags SET name = ?, sort_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [name, sort_order, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]
    );
    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function deleteHotTag(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.body;
    if (!id) {
      res.json({ code: 400, msg: '缺少id参数' });
      return;
    }
    await execute('DELETE FROM hot_tags WHERE id = ?', [id]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 排行榜元数据（类型+分类） ==========

export async function getRankingMeta(req: Request, res: Response): Promise<void> {
  try {
    const categories = await getActiveCategories();
    res.json({ code: 0, data: { types: RANK_TYPES, categories } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 排行榜分组查询 ==========

export async function getRankingsGrouped(req: Request, res: Response): Promise<void> {
  try {
    const category = String(req.query.category || '全部').trim();
    const perRank = Math.max(1, Math.min(100, parseInt(String(req.query.perRank || '20'), 10) || 20));

    const categories = await getActiveCategories();

    // 构建查询条件
    let whereSql = 'WHERE is_active = 1';
    const params: any[] = [];
    if (category && category !== '全部') {
      whereSql += ' AND (category = ? OR category = "全部")';
      params.push(category);
    }

    const rows = await query(
      `SELECT * FROM hot_rankings ${whereSql} ORDER BY sort_order ASC, download_count DESC`,
      params
    );

    // 按 rank_type 分组
    const rankings: Record<string, any[]> = {};
    for (const type of RANK_TYPES) {
      const items = (rows as any[]).filter(r => r.rank_type === type.code);
      rankings[type.code] = dedupeRankingItems(items).slice(0, perRank);
    }

    res.json({ code: 0, data: { meta: RANK_TYPES, categories, category, rankings } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 书库（本地书籍分页查询） ==========

export async function getLocalLibrary(req: Request, res: Response): Promise<void> {
  try {
    const q = normalizeLocalLibraryQuery(req.query as any);
    const { where, params } = buildLocalLibraryWhere(q.keyword, q.category);

    // 查总数
    const countRows = await query(`SELECT COUNT(*) as total FROM books ${where}`, params);
    const total = (countRows as any[])?.[0]?.total || 0;

    // 查数据
    const rows = await query(
      `SELECT id, book_url, toc_url, origin, origin_name, type, name, author, kind, category,
              cover_url, intro, total_chapter_num, latest_chapter_title, word_count, updated_at
       FROM books ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      [...params, q.pageSize, q.offset]
    );

    // 去重
    const items = dedupeLocalLibraryBooks(rows as any[]).map((b: any) => ({
      id: b.id,
      bookUrl: b.book_url,
      tocUrl: b.toc_url,
      origin: b.origin,
      originName: b.origin_name,
      type: b.type,
      name: b.name,
      author: b.author,
      kind: b.kind,
      category: b.category,
      coverUrl: b.cover_url,
      intro: b.intro,
      totalChapterNum: b.total_chapter_num,
      latestChapterTitle: b.latest_chapter_title,
      wordCount: b.word_count,
      updatedAt: b.updated_at,
    }));

    res.json({ code: 0, data: { items, total, page: q.page, pageSize: q.pageSize } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 一键刷新排行榜（从 books 表自动生成） ==========

export async function refreshRankings(req: Request, res: Response): Promise<void> {
  try {
    // 1. 从 books 表读取所有书籍作为种子数据
    const rows = await query(
      `SELECT name, author, cover_url, intro, kind, book_url,
              total_chapter_num, word_count, updated_at
       FROM books`
    ) as any[];

    const seeds: AutoRankingBookSeed[] = rows.map(b => ({
      name: b.name,
      author: b.author || '',
      coverUrl: b.cover_url || '',
      intro: b.intro || '',
      kind: b.kind || '',
      bookUrl: b.book_url || '',
      readers: 0, // 本地没有阅读量数据，用 0 填充
      reviews: 0,
      chapterCount: b.total_chapter_num || 0,
      wordCount: b.word_count || 0,
      isComplete: false,
      latestChapterTime: b.updated_at || '',
    }));

    // 2. 自动生成 6 类榜单
    const result = buildAutoRankingsFromBooks(seeds, 20);

    // 3. 清空旧数据并写入新数据
    await execute('DELETE FROM hot_rankings WHERE 1=1');

    for (const [type, items] of Object.entries(result)) {
      for (const item of items) {
        await execute(
          `INSERT INTO hot_rankings (name, author, cover_url, intro, book_url, rank_type, category,
            download_count, rating, review_count, chapter_count, word_count, is_complete, extra, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.name, item.author, item.cover_url, item.intro, item.book_url, item.rank_type, item.category,
            item.download_count, item.rating, item.review_count, item.chapter_count, item.word_count,
            item.is_complete, item.extra, item.sort_order, item.is_active]
        );
      }
    }

    // 4. 统计
    const total = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
    res.json({ code: 0, msg: `刷新成功，共生成 ${total} 条排行榜数据`, data: total });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}
