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
import { getPrefetchChapterIndexes, getRuntimeChapterContent, setRuntimeChapterContent } from '../../services/chapterRuntimeCache';
import { fetchCollectorChapterContent } from '../../services/collectorPlugin';
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

async function isCollectorCachedBook(bookUrl: string): Promise<boolean> {
  const book = await queryOne('SELECT origin_name FROM books WHERE book_url = ?', [bookUrl]);
  const originName = String(book?.origin_name || '').trim();
  if (!originName) return false;
  const rule = await queryOne('SELECT id FROM collector_rules WHERE name = ? AND enabled = 1 LIMIT 1', [originName]);
  return Boolean(rule);
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

export async function getChapterList(req: Request, res: Response): Promise<void> {
  try {
    const { bookUrl, sourceUrl } = req.query;
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少bookUrl参数' });
      return;
    }

    let chapters = await query(
      'SELECT * FROM book_chapters WHERE book_url = ? ORDER BY chapter_index ASC',
      [bookUrl as string]
    );

    if (chapters.length > 0 && !hasUsableCachedChapters(chapters)) {
      await execute('DELETE FROM book_chapters WHERE book_url = ?', [bookUrl as string]);
      chapters = [];
    }
    if (chapters.length > 0) {
      const normalized = normalizeChapterList(chapters, {
        dedupeTitle: !(await isCollectorCachedBook(bookUrl as string)),
      });
      if (normalized.length !== chapters.length) {
        await transaction(async (conn) => {
          await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [bookUrl as string]);
          for (const ch of normalized) {
            await conn.execute(
              'INSERT INTO book_chapters (book_url, chapter_index, title, url) VALUES (?, ?, ?, ?)',
              [bookUrl as string, ch.index, ch.title, ch.url]
            );
          }
        });
      }
      chapters = normalized;
    }

    if (chapters.length === 0) {
      const book = await queryOne('SELECT * FROM books WHERE book_url = ?', [bookUrl as string]);
      const origin = book?.origin || sourceUrl;
      if (origin) {
        const source = await queryOne('SELECT * FROM book_sources WHERE book_source_url = ?', [origin as string]);
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
            const toc = normalizeChapterList(await engine.getChapterList(source, tocBook));
            if (toc && hasUsableCachedChapters(toc)) {
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
            } else if (toc && toc.length > 0) {
              await execute('DELETE FROM book_chapters WHERE book_url = ?', [bookUrl as string]);
              chapters = [];
            }
          } catch (e) {
            console.error('[BookController] 刷新目录失败:', e);
          }
        }
      }
    }

    res.json({ code: 0, data: chapters });
  } catch (err: any) {
    sendError(res, err, '获取阅读内容失败');
    return;
  }
}

// 获取章节内容：当前章节不落库，只读运行时预取缓存；未命中则实时抓取原站。
async function loadChapterContent(params: {
  bookUrl: string;
  chapterRow: any;
  book: any;
  origin: any;
  cleanerRules: ContentCleanerRules;
  cacheResult?: boolean;
}): Promise<{ title: string; content: string; index: number } | null> {
  const { bookUrl, chapterRow, book, origin, cleanerRules, cacheResult = false } = params;
  const chapterIdx = Number(chapterRow.chapter_index);
  return chapterContentLoadQueue.run(bookUrl, chapterIdx, async () => {
    const runtimeCached = getRuntimeChapterContent(bookUrl, chapterIdx);
    if (runtimeCached) {
      return { title: chapterRow.title, content: cleanContent(runtimeCached, cleanerRules), index: chapterIdx };
    }
    if (!origin) return null;
    const originName = String(book?.origin_name || book?.originName || '').trim();
    if (originName) {
      const collectorContent = await fetchCollectorChapterContent(originName, chapterRow.url).catch(() => null);
      if (collectorContent) {
        const cleanedContent = cleanContent(collectorContent, cleanerRules);
        if (cacheResult) {
          setRuntimeChapterContent(bookUrl, chapterIdx, cleanedContent);
        }
        return { title: chapterRow.title, content: cleanedContent, index: chapterIdx };
      }
    }
    const source = await queryOne('SELECT * FROM book_sources WHERE book_source_url = ?', [origin as string]);
    if (!source) return null;
    const engine = new WebBookEngine();
    const contentBook = book || {
      book_url: bookUrl,
      bookUrl,
      toc_url: bookUrl,
      tocUrl: bookUrl,
      origin,
    };
    const content = await engine.getContent(source, contentBook, chapterRow);
    if (!content) return null;
    const cleanedContent = cleanContent(content, cleanerRules);
    if (cacheResult) {
      setRuntimeChapterContent(bookUrl, chapterIdx, cleanedContent);
    }
    return { title: chapterRow.title, content: cleanedContent, index: chapterIdx };
  });
}

function preloadNeighborChapters(params: {
  bookUrl: string;
  chapterIndex: number;
  book: any;
  origin: any;
  cleanerRules: ContentCleanerRules;
}): void {
  const { bookUrl, chapterIndex, book, origin, cleanerRules } = params;
  setTimeout(async () => {
    const neighbors = await query(
      `SELECT * FROM book_chapters
       WHERE book_url = ? AND chapter_index IN (${getPrefetchChapterIndexes(chapterIndex).map(() => '?').join(',')})
       ORDER BY chapter_index ASC`,
      [bookUrl, ...getPrefetchChapterIndexes(chapterIndex)]
    );
    await Promise.allSettled(neighbors.map((chapterRow: any) => loadChapterContent({
      bookUrl,
      chapterRow,
      book,
      origin,
      cleanerRules,
      cacheResult: true,
    })));
  }, 0);
}

async function hasSwitchableChapters(engine: WebBookEngine, source: any, book: any, timeoutMs: number): Promise<boolean> {
  try {
    const toc = await Promise.race<any[]>([
      engine.getChapterList(source, {
        ...book,
        book_url: book.bookUrl || book.book_url,
        bookUrl: book.bookUrl || book.book_url,
        toc_url: book.bookUrl || book.book_url,
        tocUrl: book.bookUrl || book.book_url,
        origin: source.book_source_url || source.bookSourceUrl,
      }),
      new Promise<any[]>((resolve) => setTimeout(() => resolve([]), timeoutMs)),
    ]);
    return Array.isArray(toc) && toc.some(isUsableChapter);
  } catch {
    return false;
  }
}

export async function getBookContent(req: Request, res: Response): Promise<void> {
  try {
    const { bookUrl, chapterUrl, sourceUrl } = req.query;
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
    const cleanerRules = await getContentCleanerRules();
    const user = (req as any).user;

    if (!user) {
      const readingSettings = await getReadingSettings();
      if (!canGuestReadChapter(Number(chapterIdx), readingSettings.guestReadChapterLimit)) {
        res.json({
          code: 403,
          msg: `登录后继续阅读，未登录最多可阅读前 ${Math.max(readingSettings.guestReadChapterLimit, 0)} 章`,
          data: {
            requiresLogin: true,
            reason: 'guest_read_limit',
            guestReadChapterLimit: readingSettings.guestReadChapterLimit,
            chapterIndex: Number(chapterIdx),
          },
        });
        return;
      }
    }

    const book = await queryOne('SELECT * FROM books WHERE book_url = ?', [bookUrl as string]);
    const origin = book?.origin || sourceUrl;
    if (!book && !origin) {
      res.json({ code: 404, msg: '书籍不存在' });
      return;
    }

    try {
      const data = await loadChapterContent({
        bookUrl: bookUrl as string,
        chapterRow,
        book,
        origin,
        cleanerRules,
        cacheResult: false,
      });
      if (data) {
        res.json({ code: 0, data });
        if (user) {
          preloadNeighborChapters({
            bookUrl: bookUrl as string,
            chapterIndex: Number(chapterIdx),
            book,
            origin,
            cleanerRules,
          });
        }
        return;
      }
    } catch (e: any) {
      console.error('[BookController] 获取内容失败:', e.message);
      res.json({ code: 500, msg: '获取内容失败: ' + e.message });
      return;
    }

    res.json({ code: 404, msg: '无法获取内容' });
  } catch (err: any) {
    sendError(res, err, '获取阅读内容失败');
    return;
  }
}

// 保存阅读进度

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