import express, { Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../config/database';
import { WebBookEngine } from '../services/webBookService';
import { fetchCollectorChapterContentByBook, getCollectorRuleForBook, fetchCollectorChaptersForBook } from '../services/collectorPlugin';

const router = express.Router();

// 获取书架
export async function getBookshelf(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const books = await query(`
      SELECT ub.*, b.name, b.author, b.cover_url as coverUrl, b.intro, b.total_chapter_num as totalChapterNum,
             b.origin, b.origin_name as originName, b.type, b.last_check_time as lastCheckTime,
             ub.dur_chapter_index as durChapterIndex, ub.dur_chapter_title as durChapterTitle,
             ub.dur_chapter_pos as durChapterPos, ub.dur_chapter_time as durChapterTime
      FROM user_books ub
      JOIN books b ON ub.book_url = b.book_url
      WHERE ub.user_id = ?
      ORDER BY ub.dur_chapter_time DESC
    `, [user.userId]);

    const result = books.map((b: any) => ({
      id: b.id,
      name: b.name,
      author: b.author,
      coverUrl: b.coverUrl,
      intro: b.intro,
      bookUrl: b.bookUrl || b.book_url,
      sourceUrl: b.origin,
      originName: b.originName,
      type: b.type || 0,
      totalChapterNum: b.totalChapterNum,
      durChapterIndex: b.durChapterIndex,
      durChapterTitle: b.durChapterTitle,
      durChapterPos: b.durChapterPos,
      lastReadTime: b.durChapterTime,
    }));

    res.json({ code: 0, data: result });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 添加书籍到书架
export async function addBook(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { bookUrl, name, author, coverUrl, intro, origin, originName, sourceUrl } = req.body;

    const existing = await queryOne('SELECT * FROM user_books WHERE user_id = ? AND book_url = ?', [user.userId, bookUrl]);
    if (existing) {
      res.json({ code: 0, msg: '已在书架中', data: existing });
      return;
    }

    await execute(`
      INSERT IGNORE INTO books (book_url, name, author, cover_url, intro, origin, origin_name, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `, [bookUrl, name || '', author || '', coverUrl || '', intro || '', origin || sourceUrl || '', originName || '']);

    await execute('INSERT INTO user_books (user_id, book_url) VALUES (?, ?)', [user.userId, bookUrl]);

    const book = await queryOne(`
      SELECT b.*, ub.dur_chapter_index as durChapterIndex, ub.dur_chapter_title as durChapterTitle
      FROM user_books ub JOIN books b ON ub.book_url = b.book_url
      WHERE ub.user_id = ? AND ub.book_url = ?
    `, [user.userId, bookUrl]);

    res.json({ code: 0, data: book });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 从书架移除
export async function removeBook(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { bookUrl } = req.body;
    await execute('DELETE FROM user_books WHERE user_id = ? AND book_url = ?', [user.userId, bookUrl]);
    res.json({ code: 0, msg: '已移除' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 获取章节列表
export async function getChapterList(req: Request, res: Response): Promise<void> {
  try {
    const { bookUrl, sourceUrl, autoSync } = req.query;
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少bookUrl参数' });
      return;
    }

    let chapters = await query(
      'SELECT * FROM book_chapters WHERE book_url = ? ORDER BY chapter_index ASC',
      [bookUrl as string]
    );

    // 判断是否需要从书源/采集同步
    // 策略：
    //   - autoSync=true（前端强制同步）：总是尝试同步，用于检测更新
    //   - autoSync=false 或 undefined（前端只读缓存）：仅当本地无章节时才同步，避免每次进入页面都触发网络请求
    //   - 采集书籍(type=1)如果本地已有章节，不因为章节数少就重新同步（采集目录是稳定的）
    const book = await queryOne('SELECT * FROM books WHERE book_url = ?', [bookUrl as string]);
    const isCollectorBook = book?.type === 1;
    const hasLocalChapters = chapters.length > 0;
    const shouldSync = autoSync === 'true'
      ? true
      : (isCollectorBook ? !hasLocalChapters : chapters.length === 0);

    if (shouldSync) {
      let syncSuccess = false;

      // 方式1：通过书源规则同步
      let origin = (book?.origin || sourceUrl) as string;
      if (origin && origin.includes('#')) {
        origin = origin.split('#')[0];
      }
      if (origin) {
        const source = await queryOne('SELECT * FROM book_sources WHERE book_source_url = ?', [origin]);
        if (source) {
          try {
            const engine = new WebBookEngine();
            const tocBook = book || {
              book_url: bookUrl,
              bookUrl,
              toc_url: bookUrl,
              tocUrl: bookUrl,
              origin,
            };
            const toc = await engine.getChapterList(source, tocBook);
            if (toc && toc.length > 0) {
              let needsUpdate = chapters.length === 0;
              if (!needsUpdate) {
                needsUpdate = checkTocNeedsUpdate(chapters, toc);
              }
              if (needsUpdate) {
                await transaction(async (conn) => {
                  await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [bookUrl as string]);
                  for (const ch of toc) {
                    await conn.execute(
                      'INSERT INTO book_chapters (book_url, chapter_index, title, url) VALUES (?, ?, ?, ?)',
                      [bookUrl as string, ch.index, ch.title, ch.url]
                    );
                  }
                  await conn.execute(
                    'UPDATE books SET total_chapter_num = ?, latest_chapter_title = ?, updated_at = NOW() WHERE book_url = ?',
                    [toc.length, toc[toc.length - 1]?.title || '', bookUrl as string]
                  );
                });
                chapters = await query(
                  'SELECT * FROM book_chapters WHERE book_url = ? ORDER BY chapter_index ASC',
                  [bookUrl as string]
                );
                console.log(`[BookController] 书源同步完成: ${bookUrl}, 共 ${toc.length} 章`);
                syncSuccess = true;
              }
            }
          } catch (e) {
            console.error('[BookController] 书源同步失败:', e);
          }
        }
      }

      // 方式2：通过采集规则同步（书源方式未成功时尝试）
      if (!syncSuccess && book) {
        try {
          const matched = await getCollectorRuleForBook(book);
          if (matched) {
            const remote = await fetchCollectorChaptersForBook(book, matched.rule);
            if (remote.chapters.length > 0) {
              let needsUpdate = chapters.length === 0;
              if (!needsUpdate) {
                needsUpdate = checkTocNeedsUpdate(chapters, remote.chapters);
              }
              if (needsUpdate) {
                await transaction(async (conn) => {
                  await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [bookUrl as string]);
                  for (const ch of remote.chapters) {
                    await conn.execute(
                      'INSERT INTO book_chapters (book_url, chapter_index, title, url) VALUES (?, ?, ?, ?)',
                      [bookUrl as string, ch.index, ch.title, ch.url]
                    );
                  }
                  await conn.execute(
                    'UPDATE books SET total_chapter_num = ?, latest_chapter_title = ?, updated_at = NOW() WHERE book_url = ?',
                    [remote.chapters.length, remote.chapters[remote.chapters.length - 1]?.title || '', bookUrl as string]
                  );
                });
                chapters = await query(
                  'SELECT * FROM book_chapters WHERE book_url = ? ORDER BY chapter_index ASC',
                  [bookUrl as string]
                );
                console.log(`[BookController] 采集同步完成: ${bookUrl}, 共 ${remote.chapters.length} 章`);
              }
            }
          }
        } catch (e) {
          console.error('[BookController] 采集同步失败:', e);
        }
      }
    }

    res.json({ code: 0, data: chapters });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

/**
 * 对比本地章节和远程章节，判断是否需要更新
 * 检查逻辑：章节总数不同，或最后3章的标题/URL不一致
 */
function checkTocNeedsUpdate(localChapters: any[], remoteToc: any[]): boolean {
  if (localChapters.length !== remoteToc.length) {
    return true;
  }
  // 检查最后3章的标题和URL是否一致
  const checkCount = Math.min(3, remoteToc.length);
  for (let i = 0; i < checkCount; i++) {
    const localIdx = localChapters.length - 1 - i;
    const remoteIdx = remoteToc.length - 1 - i;
    if (localIdx < 0) return true;
    const local = localChapters[localIdx];
    const remote = remoteToc[remoteIdx];
    if (
      local.title !== remote.title ||
      local.url !== remote.url ||
      local.chapter_index !== remote.index
    ) {
      return true;
    }
  }
  return false;
}

// 获取章节内容
export async function getBookContent(req: Request, res: Response): Promise<void> {
  try {
    const { bookUrl, chapterUrl } = req.query;
    if (!bookUrl || !chapterUrl) {
      res.json({ code: 400, msg: '缺少bookUrl或chapterUrl参数' });
      return;
    }

    const chapterRow = await queryOne(
      'SELECT * FROM book_chapters WHERE book_url = ? AND url = ?',
      [bookUrl as string, chapterUrl as string]
    );

    if (!chapterRow) {
      res.json({ code: 404, msg: '章节不存在' });
      return;
    }

    const chapterIdx = chapterRow.chapter_index;
    const chapterTitle = chapterRow.title;

    const cached = await queryOne(
      'SELECT content FROM book_contents WHERE book_url = ? AND chapter_index = ?',
      [bookUrl as string, chapterIdx]
    );

    if (cached?.content) {
      res.json({ code: 0, data: { title: chapterTitle, content: cached.content, index: chapterIdx } });
      return;
    }

    const book = await queryOne('SELECT * FROM books WHERE book_url = ?', [bookUrl as string]);
    if (!book) {
      res.json({ code: 404, msg: '书籍不存在' });
      return;
    }

    // 区分采集书籍(type=1)和在线书籍(type=0)走不同内容获取路径
    // type=1 为采集书籍，type=0 为在线书籍
    // 兼容旧数据：type=0 但在 book_sources 找不到规则时，也尝试采集规则
    const isCollectorBook = book.type === 1;
    let contentFetched = false;

    if (isCollectorBook) {
      // 采集书籍：通过 collector_rules 获取内容
      try {
        const collectorContent = await fetchCollectorChapterContentByBook(book, chapterUrl as string);
        if (collectorContent) {
          await execute(
            'INSERT INTO book_contents (book_url, chapter_index, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)',
            [bookUrl as string, chapterIdx, collectorContent]
          );
          res.json({ code: 0, data: { title: chapterTitle, content: collectorContent, index: chapterIdx } });
          return;
        }
      } catch (e: any) {
        console.error('[BookController] 采集规则获取内容失败:', e.message);
        res.json({ code: 500, msg: '采集内容获取失败: ' + e.message });
        return;
      }
    } else {
      // 在线书籍：通过 book_sources 获取内容
      if (book.origin) {
        const source = await queryOne('SELECT * FROM book_sources WHERE book_source_url = ?', [book.origin]);
        if (source) {
          try {
            const engine = new WebBookEngine();
            const content = await engine.getContent(source, book, chapterRow);
            if (content) {
              await execute(
                'INSERT INTO book_contents (book_url, chapter_index, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)',
                [bookUrl as string, chapterIdx, content]
              );
              res.json({ code: 0, data: { title: chapterTitle, content, index: chapterIdx } });
              return;
            }
          } catch (e: any) {
            console.error('[BookController] 获取内容失败:', e.message);
            res.json({ code: 500, msg: '获取内容失败: ' + e.message });
            return;
          }
          contentFetched = true;
        }
      }
    }

    // 兼容旧数据：type=0 但 book_sources 中无规则时，尝试采集规则兜底
    if (!isCollectorBook && !contentFetched) {
      try {
        const collectorContent = await fetchCollectorChapterContentByBook(book, chapterUrl as string);
        if (collectorContent) {
          // 自动修正 type 为采集书籍
          await execute('UPDATE books SET type = 1 WHERE book_url = ?', [bookUrl as string]);
          await execute(
            'INSERT INTO book_contents (book_url, chapter_index, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)',
            [bookUrl as string, chapterIdx, collectorContent]
          );
          res.json({ code: 0, data: { title: chapterTitle, content: collectorContent, index: chapterIdx } });
          return;
        }
      } catch (e: any) {
        console.error('[BookController] 兼容采集规则获取内容失败:', e.message);
      }
    }

    res.json({ code: 404, msg: '无法获取内容' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 保存阅读进度
export async function saveProgress(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { name, author, bookUrl, durChapterIndex, durChapterPos, durChapterTitle } = req.body;

    await execute(`
      UPDATE user_books
      SET dur_chapter_index = ?, dur_chapter_pos = ?, dur_chapter_title = ?, dur_chapter_time = NOW()
      WHERE user_id = ? AND book_url = ?
    `, [durChapterIndex, durChapterPos, durChapterTitle || '', user.userId, bookUrl]);

    res.json({ code: 0, msg: '保存成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 搜索书籍（SSE 流式推送）
export async function searchBooks(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let clientDisconnected = false;
  req.on('close', () => { clientDisconnected = true; });

  try {
    const { keyword, key, startIndex: startIndexStr, targetCount: targetCountStr } = req.query;
    const searchKey = keyword || key || '';
    if (!searchKey) {
      sendEvent({ type: 'error', msg: '缺少搜索关键词' });
      res.end();
      return;
    }

    const startIndex = Math.max(0, Number(startIndexStr) || 0);
    const targetCount = Math.max(1, Number(targetCountStr) || 10);

    sendEvent({ type: 'start', total: 0 });

    const allSources = await query(
      "SELECT * FROM book_sources WHERE enabled = 1 ORDER BY weight DESC, custom_order ASC"
    );
    const sources = allSources.slice(startIndex);

    sendEvent({ type: 'start', total: allSources.length, startIndex, remaining: sources.length });

    const results: any[] = [];
    const engine = new WebBookEngine();
    const CONCURRENCY = 8;
    const SOURCE_TIMEOUT = 15000;

    for (let i = 0; i < sources.length; i += CONCURRENCY) {
      if (clientDisconnected) { console.log('[搜索] 客户端断开，终止'); break; }
      const batch = sources.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (source) => {
          try {
            const books = await Promise.race([
              engine.search(source, searchKey as string),
              new Promise((_, reject) => setTimeout(() => reject(new Error('超时')), SOURCE_TIMEOUT))
            ]) as any[];
            if (books && books.length > 0) {
              const book = books[0];
              return {
                ...book,
                sourceUrl: source.book_source_url || source.bookSourceUrl,
                sourceName: source.book_source_name || source.bookSourceName,
              };
            }
            return null;
          } catch (e: any) {
            return null;
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value) {
          const book = r.value;
          if (!results.find((item: any) => item.bookUrl === book.bookUrl)) {
            results.push(book);
            sendEvent({ type: 'result', data: book, count: results.length });
          }
        }
      }

      const searchedSoFar = startIndex + Math.min(i + CONCURRENCY, sources.length);
      sendEvent({ type: 'progress', searched: searchedSoFar, total: allSources.length, results: results.length });
    }

    const finalSearched = startIndex + sources.length;
    const hasMore = finalSearched < allSources.length;
    sendEvent({ type: 'done', total: allSources.length, results: results.length, searched: finalSearched, hasMore });
    console.log(`[搜索完成] 关键词:"${searchKey}" 书源数:${allSources.length} 已搜索:${finalSearched} 结果数:${results.length} hasMore:${hasMore}`);
  } catch (err: any) {
    sendEvent({ type: 'error', msg: err.message });
  } finally {
    res.end();
  }
}

// 刷新目录
export async function refreshToc(req: Request, res: Response): Promise<void> {
  try {
    const { bookUrl } = req.query;
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少bookUrl参数' });
      return;
    }

    const book = await queryOne('SELECT * FROM books WHERE book_url = ?', [bookUrl as string]);
    if (!book) {
      res.json({ code: 404, msg: '书籍不存在' });
      return;
    }

    let chapters: any[] = [];
    if (book.origin) {
      const source = await queryOne('SELECT * FROM book_sources WHERE book_source_url = ?', [book.origin]);
      if (source) {
        const engine = new WebBookEngine();
        const toc = await engine.getChapterList(source, book);
        if (toc && toc.length > 0) {
          await transaction(async (conn) => {
            await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [bookUrl as string]);
            for (const ch of toc) {
              await conn.execute(
                'INSERT INTO book_chapters (book_url, chapter_index, title, url) VALUES (?, ?, ?, ?)',
                [bookUrl as string, ch.index, ch.title, ch.url]
              );
            }
          });
          chapters = await query(
            'SELECT * FROM book_chapters WHERE book_url = ? ORDER BY chapter_index ASC',
            [bookUrl as string]
          );
        }
      }
    }

    res.json({ code: 0, data: chapters });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 获取/设置 APP 设置
export async function getAppSettings(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;

    if (req.method === 'POST') {
      const { legadoAppUrl } = req.body;
      await execute(
        'INSERT INTO app_settings (user_id, `key`, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [user.userId, 'legadoAppUrl', legadoAppUrl || '']
      );
      res.json({ code: 0, msg: '保存成功' });
    } else {
      const row = await queryOne(
        'SELECT value FROM app_settings WHERE user_id = ? AND `key` = ?',
        [user.userId, 'legadoAppUrl']
      );
      res.json({ code: 0, data: { legadoAppUrl: row?.value || '' } });
    }
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export default router;

/**
 * 异步检查并更新章节列表
 * 进入书籍详情页时自动检查远程目标站的章节目录，发现新章节则自动添加
 */
async function syncChapterListForBook(bookUrl: string, origin: string): Promise<void> {
  try {
    // 获取书源配置
    const source = await queryOne('SELECT * FROM book_sources WHERE book_source_url = ?', [origin]);
    if (!source) return;

    // 获取本地最大章节索引
    const localMax = await queryOne(
      'SELECT MAX(chapter_index) AS maxIndex FROM book_chapters WHERE book_url = ?',
      [bookUrl]
    );
    const localMaxIndex = localMax?.maxIndex ?? -1;

    // 如果本地已有章节数较少（<5章），说明可能只采集了部分，用全量替换方式
    const localCount = await queryOne(
      'SELECT COUNT(*) AS count FROM book_chapters WHERE book_url = ?',
      [bookUrl]
    );
    const totalLocal = Number(localCount?.count || 0);
    const useFullReplace = totalLocal > 0 && totalLocal < 5;

    // 构建目录书对象
    const book = await queryOne('SELECT * FROM books WHERE book_url = ?', [bookUrl]);
    const tocBook = book || { book_url: bookUrl, bookUrl, toc_url: bookUrl, tocUrl: bookUrl, origin };

    // 从远程获取章节目录
    const engine = new WebBookEngine();
    const toc = await engine.getChapterList(source, tocBook);
    if (!toc || toc.length === 0) return;

    if (useFullReplace) {
      // 本地章节数少，全量替换
      await transaction(async (conn) => {
        await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [bookUrl]);
        for (const ch of toc) {
          await conn.execute(
            'INSERT INTO book_chapters (book_url, chapter_index, title, url) VALUES (?, ?, ?, ?)',
            [bookUrl, ch.index, ch.title, ch.url]
          );
        }
        await conn.execute(
          'UPDATE books SET total_chapter_num = ?, latest_chapter_title = ?, updated_at = NOW() WHERE book_url = ?',
          [toc.length, toc[toc.length - 1]?.title || '', bookUrl]
        );
      });
      console.log(`[BookController] 章节全量更新完成: ${bookUrl}, 共 ${toc.length} 章`);
      return;
    }

    // 只插入本地不存在的章节（索引比本地最大索引大的新章节）
    const newChapters = toc.filter(ch => ch.index > localMaxIndex);
    if (newChapters.length === 0) return;

    await transaction(async (conn) => {
      for (const ch of newChapters) {
        await conn.execute(
          'INSERT INTO book_chapters (book_url, chapter_index, title, url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), url=VALUES(url)',
          [bookUrl, ch.index, ch.title, ch.url]
        );
      }
      // 更新书籍的章节总数和最新章节标题
      const latestTitle = toc[toc.length - 1]?.title || '';
      await conn.execute(
        'UPDATE books SET total_chapter_num = ?, latest_chapter_title = ?, updated_at = NOW() WHERE book_url = ?',
        [toc.length, latestTitle, bookUrl]
      );
    });

    console.log(`[BookController] 自动更新章节完成: ${bookUrl}, 新增 ${newChapters.length} 章`);
  } catch (e) {
    console.error('[BookController] 自动检查章节更新失败:', e);
  }
}

// 通过 bookUrl 获取书籍基本信息（名称、作者、封面、简介等）
export async function getBookInfo(req: Request, res: Response): Promise<void> {
  try {
    const { bookUrl, sourceUrl } = req.query;
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少bookUrl参数' });
      return;
    }

    // 1. 先从 books 表查询
    const book = await queryOne('SELECT * FROM books WHERE book_url = ?', [bookUrl as string]);
    if (book) {
      res.json({
        code: 0,
        data: {
          name: book.name || book.book_name || '',
          author: book.author || '',
          coverUrl: book.cover_url || book.coverUrl || '',
          intro: book.intro || '',
          kind: book.kind || book.type || '',
          type: book.type ?? 0,
          latestChapterTitle: book.latest_chapter_title || '',
          latestChapterUrl: book.latest_chapter_url || '',
          sourceUrl: book.origin || sourceUrl || '',
          sourceName: book.source_name || '',
        },
      });
      // 异步检查章节更新（不阻塞响应）
      if (book.origin) {
        syncChapterListForBook(bookUrl as string, book.origin);
      }
      return;
    }

    // 2. 从书源实时抓取
    let origin = sourceUrl as string;
    if (origin && origin.includes('#')) {
      origin = origin.split('#')[0];
    }
    if (origin) {
      const source = await queryOne('SELECT * FROM book_sources WHERE book_source_url = ?', [origin]);
      if (source) {
        try {
          const engine = new WebBookEngine();
          const info = await engine.getBookInfo(source, bookUrl as string);
          if (info && info.name) {
            res.json({
              code: 0,
              data: {
                name: info.name || '',
                author: info.author || '',
                coverUrl: info.coverUrl || '',
                intro: info.intro || '',
                kind: info.kind || '',
                latestChapterTitle: info.latestChapterTitle || '',
                sourceUrl: origin,
                sourceName: source.book_source_name || '',
              },
            });
            // 异步检查章节更新
            syncChapterListForBook(bookUrl as string, origin);
            return;
          }
        } catch (e) {
          console.error('[BookController] 获取书籍信息失败:', e);
        }
      }
    }

    // 3. 没有找到信息
    res.json({ code: 0, data: {} });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}
