import { Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../../config/database';
import { SearchBookResult, WebBookEngine } from '../../services/webBookService';
import { getSearchCache } from '../../services/searchCache';
import { hasAvailableChapters, isUsableChapter } from '../../services/sourceAvailability';
import { cleanContent, normalizeContentCleanerRules, type ContentCleanerRules } from '../../services/contentCleaner';
import { buildAlternateSourceResult } from '../../services/alternateSource';
import { buildAlternateSourceCacheKey, getAlternateSourceCache, setAlternateSourceCache } from '../../services/alternateSourceCache';
import { dedupeBookshelfRows, getBookIdentityKey } from '../../services/bookshelfDeduper';
import { autoDetectCategory, getActiveCategories } from '../../services/rankingService';
import { canGuestReadChapter, canGuestUseSourceSwitch, getReadingSettings } from '../../services/readingSettings';
import { acquireSearchSlot } from '../../services/searchConcurrency';
import { aggregateSearchResults, classifySearchResult, getSearchMatchScore, getSearchWindow, rankSearchResults } from '../../services/searchResultRanking';
import { getSearchSwitchSettings } from '../../services/searchSwitchSettings';
import { verifySwitchTargetReadable } from '../../services/switchSourceVerification';
import { recordSourceHealth, sortSourcesByHealth } from '../../services/sourceHealth';
import { recordUserSearch } from '../../services/userRecordService';
import { chapterContentLoadQueue } from '../../services/chapterContentLoader';
import { verifyReadableBookCandidate, verifyReadableSwitchCandidate } from '../../services/readabilityVerification';
import { normalizeChapterList } from '../../services/chapterListNormalizer';
import { createStreamCancellationState } from '../../services/streamCancellation';
import {
  createBookComment,
  deleteBookComment,
  getBookComments,
  getBookSocialStats,
  toggleBookLike,
} from '../../services/bookSocialService';
import { config } from '../../config';
import { buildSearchRequestOptions } from '../../services/bookSourceHttpClient';
import { sendError } from '../../utils/apiResponse';

function normalizeText(value: any): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

/** 判断作者是否有效（非空、非未知、非无作者） */
function isValidAuthor(author: any): boolean {
  const a = normalizeText(author);
  if (!a) return false;
  const invalidPatterns = ['未知', '佚名', '无作者', '作者不详', '暂无作者', '未知作者', 'null', 'undefined', 'n/a'];
  return !invalidPatterns.some(p => a.includes(p));
}

function isSameBook(candidate: SearchBookResult, book: any): boolean {
  const candidateName = normalizeText(candidate.name);
  const bookName = normalizeText(book.name);
  if (!candidateName || !bookName || candidateName !== bookName) return false;

  const candidateAuthor = normalizeText(candidate.author);
  const bookAuthor = normalizeText(book.author);
  return !candidateAuthor || !bookAuthor || candidateAuthor.includes(bookAuthor) || bookAuthor.includes(candidateAuthor);
}

function hasUsableCachedChapters(chapters: any[], minChapters = 10): boolean {
  if (!Array.isArray(chapters) || chapters.length < minChapters) return false;
  let usable = 0;
  for (const chapter of chapters) {
    if (isUsableChapter(chapter)) {
      usable++;
      if (usable >= minChapters) return true;
    }
  }
  return false;
}

function isKnownUnreadableSearchCandidate(source: any, book: any): boolean {
  const sourceName = String(source?.book_source_name || source?.source_name || book?.sourceName || '').toLowerCase();
  const bookUrl = String(book?.bookUrl || book?.book_url || '').toLowerCase();
  const sourceUrl = String(source?.book_source_url || book?.sourceUrl || '').toLowerCase();
  if (sourceName.includes('喜马拉雅') || sourceName.includes('ximalaya')) return true;
  if (sourceName.includes('污书屋') || bookUrl.includes('miaoquan2016.com') || sourceUrl.includes('miaoquan2016.com')) return true;
  if (sourceName.includes('蚂蚁阅读') || bookUrl.includes('wap.mayitxt.org') || sourceUrl.includes('wap.mayitxt.org')) return true;
  if (sourceName.includes('猫眼看书') || bookUrl.includes('api.jmlldsc.com') || sourceUrl.includes('api.jmlldsc.com')) return true;
  return false;
}

function getSearchTransportCacheVersion(settings: { searchRequestUserAgents?: string; searchRequestProxy?: string }): string {
  const raw = `${settings.searchRequestUserAgents || ''}|${settings.searchRequestProxy || ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function persistVerifiedSwitchData(bookUrl: string, verified: any) {
  if (!verified?.ok || !Array.isArray(verified.toc)) return;
  const normalizedToc = normalizeChapterList(verified.toc);
  await transaction(async (conn) => {
    await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [bookUrl]);
    for (let i = 0; i < normalizedToc.length; i++) {
      const chapter = normalizedToc[i];
      await conn.execute(
        'INSERT INTO book_chapters (book_url, chapter_index, title, url) VALUES (?, ?, ?, ?)',
        [bookUrl, chapter.index ?? i, chapter.title, chapter.url]
      );
    }
  });
}

async function getContentCleanerRules(): Promise<ContentCleanerRules> {
  try {
    const item = await queryOne('SELECT config_value FROM site_config WHERE config_key = ?', ['content_cleaner_rules']);
    return normalizeContentCleanerRules(item?.config_value || null);
  } catch {
    return normalizeContentCleanerRules(null);
  }
}

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

    const result = dedupeBookshelfRows(books.map((b: any) => ({
      id: b.id,
      name: b.name,
      author: b.author,
      coverUrl: b.coverUrl,
      intro: b.intro,
      bookUrl: b.bookUrl || b.book_url,
      sourceUrl: b.origin,
      originName: b.originName,
      totalChapterNum: b.totalChapterNum,
      durChapterIndex: b.durChapterIndex,
      durChapterTitle: b.durChapterTitle,
      durChapterPos: b.durChapterPos,
      lastReadTime: b.durChapterTime,
    })));

    res.json({ code: 0, data: result });
  } catch (err: any) {
    sendError(res, err, '书架操作失败');
    return;
  }
}

// 添加书籍到书架
export async function addBook(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { bookUrl, name, author, coverUrl, intro, origin, originName, sourceUrl, kind } = req.body;

    const existing = await queryOne('SELECT * FROM user_books WHERE user_id = ? AND book_url = ?', [user.userId, bookUrl]);
    if (existing) {
      res.json({ code: 0, msg: '已在书架中', data: existing });
      return;
    }

    if (name) {
      const shelfBooks = await query(`
        SELECT ub.*, b.name, b.author, b.cover_url as coverUrl, b.intro, b.total_chapter_num as totalChapterNum,
               b.origin, b.origin_name as originName, b.type, b.last_check_time as lastCheckTime,
               ub.dur_chapter_index as durChapterIndex, ub.dur_chapter_title as durChapterTitle,
               ub.dur_chapter_pos as durChapterPos, ub.dur_chapter_time as durChapterTime,
               b.kind, b.category
        FROM user_books ub
        JOIN books b ON ub.book_url = b.book_url
        WHERE ub.user_id = ?
        ORDER BY ub.dur_chapter_time DESC
      `, [user.userId]);
      const newKey = getBookIdentityKey({ name, author });
      const duplicate = shelfBooks.find((item: any) => getBookIdentityKey(item) === newKey);
      if (duplicate) {
        res.json({
          code: 0,
          msg: '同名同作者书籍已在书架中',
          data: {
            ...duplicate,
            bookUrl: duplicate.bookUrl || duplicate.book_url,
            sourceUrl: duplicate.origin,
            originName: duplicate.originName,
            kind: duplicate.kind,
            category: duplicate.category,
          },
        });
        return;
      }
    }

    // 确保分类缓存已初始化（首次调用会从 DB 加载 book_categories）
    await getActiveCategories();
    const detectedCategory = autoDetectCategory({ kind, name, intro });

    await execute(`
      INSERT IGNORE INTO books (book_url, name, author, cover_url, intro, origin, origin_name, type, kind, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      bookUrl,
      name || '',
      author || '',
      coverUrl || '',
      intro || '',
      origin || sourceUrl || '',
      originName || '',
      kind || '',
      detectedCategory,
    ]);

    await execute('INSERT INTO user_books (user_id, book_url) VALUES (?, ?)', [user.userId, bookUrl]);

    const book = await queryOne(`
      SELECT b.*, ub.dur_chapter_index as durChapterIndex, ub.dur_chapter_title as durChapterTitle
      FROM user_books ub JOIN books b ON ub.book_url = b.book_url
      WHERE ub.user_id = ? AND ub.book_url = ?
    `, [user.userId, bookUrl]);

    res.json({ code: 0, data: book });
  } catch (err: any) {
    sendError(res, err, '书架操作失败');
    return;
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
    sendError(res, err, '书架操作失败');
    return;
  }
}


export async function saveProgress(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const {
      bookUrl,
      name,
      author,
      coverUrl,
      intro,
      sourceUrl,
      origin,
      originName,
      chapterIndex,
      chapterPos,
      chapterTitle,
      durChapterIndex,
      durChapterPos,
      durChapterTitle,
    } = req.body;

    const finalChapterIndex = Number(durChapterIndex ?? chapterIndex ?? 0);
    const finalChapterPos = Number(durChapterPos ?? chapterPos ?? 0);
    const finalChapterTitle = String(durChapterTitle ?? chapterTitle ?? '');

    await execute(`
      INSERT IGNORE INTO books (book_url, name, author, cover_url, intro, origin, origin_name, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      bookUrl,
      name || '',
      author || '',
      coverUrl || '',
      intro || '',
      origin || sourceUrl || '',
      originName || '',
    ]);

    await execute('INSERT IGNORE INTO user_books (user_id, book_url) VALUES (?, ?)', [user.userId, bookUrl]);

    await execute(`
      UPDATE user_books
      SET dur_chapter_index = ?, dur_chapter_pos = ?, dur_chapter_title = ?, dur_chapter_time = NOW()
      WHERE user_id = ? AND book_url = ?
    `, [finalChapterIndex, finalChapterPos, finalChapterTitle, user.userId, bookUrl]);

    res.json({ code: 0, msg: '保存成功' });
  } catch (err: any) {
    sendError(res, err, '书架操作失败');
    return;
  }
}

// 搜索书籍（SSE 流式推送：持续搜索直到凑够 targetCount 条有效结果，或搜完全部书源）
// URL 参数: keyword, startIndex (default 0), targetCount (default 10) —— 要返回多少条有效结果
// 缓存策略: Redis 按关键词缓存每轮（startIndex → 实际停止位置）的结果

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
    sendError(res, err, '书架操作失败');
    return;
  }
}
