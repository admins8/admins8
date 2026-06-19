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
import { aggregateSearchResults, classifySearchResult, getAggregateKey, getSearchMatchScore, getSearchWindow, rankSearchResults } from '../../services/searchResultRanking';
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
import { buildLocalBookResult } from '../../services/localBookPriority';

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

export function isSameBook(candidate: SearchBookResult, book: any): boolean {
  const candidateName = normalizeText(candidate.name);
  const bookName = normalizeText(book.name);
  if (!candidateName || !bookName || candidateName !== bookName) return false;

  const candidateAuthor = normalizeText(candidate.author);
  const bookAuthor = normalizeText(book.author);
  return !candidateAuthor || !bookAuthor || candidateAuthor.includes(bookAuthor) || bookAuthor.includes(candidateAuthor);
}

export function shouldAllowUnverifiedSwitchCandidate(candidate: SearchBookResult, book: any): boolean {
  const candidateName = normalizeText(candidate.name);
  const bookName = normalizeText(book.name);
  const candidateAuthor = normalizeText(candidate.author);
  const bookAuthor = normalizeText(book.author);
  return Boolean(candidate.bookUrl)
    && Boolean(candidateName)
    && candidateName === bookName
    && Boolean(candidateAuthor)
    && Boolean(bookAuthor)
    && isValidAuthor(candidate.author)
    && (candidateAuthor.includes(bookAuthor) || bookAuthor.includes(candidateAuthor));
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

export function shouldIncludeLocalAlternateBook(row: any, book: any): boolean {
  return isSameBook(row as SearchBookResult, book);
}

async function findLocalAlternateBooks(book: any, currentBookUrl: string): Promise<any[]> {
  const name = String(book?.name || '').trim();
  if (!name) return [];
  const rows = await query(
    `SELECT book_url AS bookUrl,
            name,
            author,
            cover_url AS coverUrl,
            intro,
            origin AS sourceUrl,
            origin_name AS sourceName,
            type,
            kind,
            latest_chapter_title AS latestChapterTitle,
            word_count AS wordCount
       FROM books
      WHERE name = ?
      ORDER BY (book_url = ?) DESC, updated_at DESC
      LIMIT 5`,
    [name, currentBookUrl]
  );
  return (rows || [])
    .filter((row: any) => shouldIncludeLocalAlternateBook(row, book))
    .map((row: any) => ({
      ...buildLocalBookResult(row, {
        matchLevel: 'exact',
        matchLabel: '本地书库',
        matchScore: 9999,
      }),
      isCurrentSource: String(row.bookUrl || '').trim() === currentBookUrl,
      matchScore: 9999,
    }));
}

function mergeLocalFirst(localResults: any[], remoteResults: any[]): any[] {
  const merged: any[] = [];
  const localAggregateKeys = new Set(localResults.map(item => getAggregateKey(item)).filter(Boolean));
  const seenBookUrls = new Set<string>();
  const seenLocalAggregateKeys = new Set<string>();
  for (const item of [...localResults, ...remoteResults]) {
    if (!item?.bookUrl) continue;
    const bookUrl = String(item.bookUrl || '').trim();
    const aggregateKey = getAggregateKey(item);
    if (seenBookUrls.has(bookUrl)) continue;
    if (item._local && aggregateKey && seenLocalAggregateKeys.has(aggregateKey)) continue;
    if (!item._local && aggregateKey && localAggregateKeys.has(aggregateKey)) continue;
    seenBookUrls.add(bookUrl);
    if (item._local && aggregateKey) seenLocalAggregateKeys.add(aggregateKey);
    merged.push(item);
  }
  return merged;
}

// 获取书架

export async function getAlternateSources(req: Request, res: Response): Promise<void> {
  try {
    const { bookUrl, name, author, sourceUrl, chapterIndex } = req.query;
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少bookUrl参数' });
      return;
    }

    const user = (req as any).user;
    const currentChapterIndex = Number(chapterIndex ?? 0);
    if (!user) {
      const readingSettings = await getReadingSettings();
      if (!canGuestUseSourceSwitch(currentChapterIndex, readingSettings.guestReadChapterLimit)) {
        res.json({
          code: 403,
          msg: '登录后继续换源',
          data: {
            requiresLogin: true,
            reason: 'guest_read_limit',
            guestReadChapterLimit: readingSettings.guestReadChapterLimit,
            chapterIndex: currentChapterIndex,
          },
        });
        return;
      }
    }

    const dbBook = await queryOne('SELECT * FROM books WHERE book_url = ?', [bookUrl as string]);
    const book = dbBook || {
      book_url: bookUrl,
      bookUrl,
      name: String(name || ''),
      author: String(author || ''),
      origin: String(sourceUrl || ''),
      origin_name: '',
    };

    if (!book.name) {
      res.json({ code: 404, msg: '书籍不存在' });
      return;
    }

    const searchSettings = await getSearchSwitchSettings();
    const searchRequestOptions = buildSearchRequestOptions(searchSettings);
    const transportCacheVersion = getSearchTransportCacheVersion(searchSettings);
    const localResults = await findLocalAlternateBooks(book, String(bookUrl));
    const cacheKey = `${buildAlternateSourceCacheKey({
      bookUrl: String(bookUrl),
      name: book.name,
      author: book.author,
      sourceUrl: String(sourceUrl || book.origin || ''),
      chapterIndex: currentChapterIndex,
    })}:toc-readable-v1:${transportCacheVersion}`;
    const cachedSources = await getAlternateSourceCache(cacheKey);
    if (cachedSources) {
      res.json({ code: 0, data: mergeLocalFirst(localResults, cachedSources), cached: true });
      return;
    }

    const rawSources = await query(
      `SELECT id, book_source_url, book_source_name, search_url, rule_search, rule_toc, header, weight, custom_order, last_check_status
       FROM book_sources
       WHERE enabled = 1
       ORDER BY weight DESC, custom_order ASC`
    );
    const sources = await sortSourcesByHealth(rawSources);

    const CONCURRENCY = searchSettings.sourceSwitchConcurrency;
    const SOURCE_TIMEOUT = searchSettings.sourceSwitchTimeoutMs;
    const TOC_TIMEOUT = searchSettings.sourceSwitchTocTimeoutMs;
    const results: any[] = [...localResults];
    const localAggregateKeys = new Set(localResults.map(item => getAggregateKey(item)).filter(Boolean));

    for (let i = 0; i < sources.length && results.length < 30; i += CONCURRENCY) {
      const batch = sources.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (source) => {
          try {
            const sourceEngine = new WebBookEngine(searchRequestOptions);
            const startedAt = Date.now();
            const books = await Promise.race<SearchBookResult[]>([
              sourceEngine.search(source, book.name),
              new Promise<SearchBookResult[]>((_, reject) => setTimeout(() => reject(new Error('超时')), SOURCE_TIMEOUT)),
            ]);
            await recordSourceHealth(source, Array.isArray(books) && books.length > 0, Date.now() - startedAt);
            const sourceUrl = source.book_source_url || source.bookSourceUrl;
            const isCurrentSource = String(sourceUrl || '') === String(book.origin || '');
            const matched = books.find(item => (isCurrentSource || item.bookUrl !== bookUrl) && isSameBook(item, book));
            if (!matched) return null;
            if (!isValidAuthor(matched.author)) {
              console.log(`[换源过滤] ${source.book_source_name || source.bookSourceName}: 《${matched.name}》作者无效(${matched.author})`);
              return null;
            }
            const readable = await verifyReadableSwitchCandidate({
              engine: sourceEngine,
              source,
              book: matched,
              chapterIndex: currentChapterIndex,
              timeoutMs: Math.max(TOC_TIMEOUT, SOURCE_TIMEOUT),
            });
            if (!readable.readable && !shouldAllowUnverifiedSwitchCandidate(matched, book)) return null;
            return {
              ...buildAlternateSourceResult(matched, source, book),
              _tocVerified: readable.tocVerified,
              _contentVerified: readable.contentVerified,
              _readable: readable.readable,
              _tocCheckFailed: !readable.tocVerified,
            };
          } catch {
            await recordSourceHealth(source, false, SOURCE_TIMEOUT);
            return null;
          }
        })
      );

      for (const item of batchResults) {
        if (item.status === 'fulfilled') {
          const value = item.value;
          if (!value) continue;
          const valueAggregateKey = getAggregateKey(value);
          if (!results.some(r => r.bookUrl === value.bookUrl) && !(valueAggregateKey && localAggregateKeys.has(valueAggregateKey))) {
            results.push(value);
          }
        }
      }
    }

    results.sort((a, b) => Number(Boolean(b._local)) - Number(Boolean(a._local)) || Number(Boolean(b._tocVerified)) - Number(Boolean(a._tocVerified)) || b.matchScore - a.matchScore);
    const limitedResults = results.slice(0, 30);
    await setAlternateSourceCache(cacheKey, limitedResults, searchSettings.alternateSourceCacheTtlSeconds);
    res.json({ code: 0, data: limitedResults });
  } catch (err: any) {
    sendError(res, err, '换源失败');
    return;
  }
}

// 流式获取当前书籍的可换书源，搜到一个立即推送一个
export async function streamAlternateSources(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const cancellation = createStreamCancellationState();
  const sendEvent = (data: any) => {
    if (!cancellation.canSend() || res.destroyed || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  req.on('close', () => { cancellation.cancel(); });

  try {
    const { bookUrl, name, author, sourceUrl, chapterIndex } = req.query;
    if (!bookUrl) {
      sendEvent({ type: 'error', msg: '缺少bookUrl参数' });
      return;
    }

    const user = (req as any).user;
    const currentChapterIndex = Number(chapterIndex ?? 0);
    if (!user) {
      const readingSettings = await getReadingSettings();
      if (!canGuestUseSourceSwitch(currentChapterIndex, readingSettings.guestReadChapterLimit)) {
        sendEvent({
          type: 'error',
          code: 403,
          reason: 'guest_read_limit',
          msg: '登录后继续换源',
          data: {
            requiresLogin: true,
            guestReadChapterLimit: readingSettings.guestReadChapterLimit,
            chapterIndex: currentChapterIndex,
          },
        });
        return;
      }
    }

    const dbBook = await queryOne('SELECT * FROM books WHERE book_url = ?', [bookUrl as string]);
    const book = dbBook || {
      book_url: bookUrl,
      bookUrl,
      name: String(name || ''),
      author: String(author || ''),
      origin: String(sourceUrl || ''),
      origin_name: '',
    };

    if (!book.name) {
      sendEvent({ type: 'error', msg: '书籍不存在' });
      return;
    }

    const searchSettings = await getSearchSwitchSettings();
    const searchRequestOptions = buildSearchRequestOptions(searchSettings);
    const transportCacheVersion = getSearchTransportCacheVersion(searchSettings);
    const localResults = await findLocalAlternateBooks(book, String(bookUrl));
    const cacheKey = `${buildAlternateSourceCacheKey({
      bookUrl: String(bookUrl),
      name: book.name,
      author: book.author,
      sourceUrl: String(sourceUrl || book.origin || ''),
      chapterIndex: currentChapterIndex,
    })}:toc-readable-v1:${transportCacheVersion}`;
    const cachedSources = await getAlternateSourceCache(cacheKey);
    if (cachedSources) {
      const mergedCached = mergeLocalFirst(localResults, cachedSources);
      sendEvent({ type: 'start', total: mergedCached.length, cached: true });
      mergedCached.forEach((item, index) => {
        // 本地已采集结果保留 _local 标识，仅对真正的缓存来源标 _cached
        if (item._local) {
          sendEvent({ type: 'result', data: item, count: index + 1, cached: true, local: true });
        } else {
          sendEvent({ type: 'result', data: { ...item, _cached: true }, count: index + 1, cached: true });
        }
      });
      sendEvent({ type: 'done', total: mergedCached.length, results: mergedCached.length, cached: true });
      return;
    }

    const rawSources = await query(
      `SELECT id, book_source_url, book_source_name, search_url, rule_search, rule_toc, header, weight, custom_order, last_check_status
       FROM book_sources
       WHERE enabled = 1
       ORDER BY weight DESC, custom_order ASC`
    );
    const sources = await sortSourcesByHealth(rawSources);

    sendEvent({ type: 'start', total: sources.length + localResults.length });

    const CONCURRENCY = searchSettings.sourceSwitchConcurrency;
    const SOURCE_TIMEOUT = searchSettings.sourceSwitchTimeoutMs;
    const TOC_TIMEOUT = searchSettings.sourceSwitchTocTimeoutMs;
    const results: any[] = [];
    const localAggregateKeys = new Set(localResults.map(item => getAggregateKey(item)).filter(Boolean));
    for (const item of localResults) {
      results.push(item);
      sendEvent({ type: 'result', data: item, count: results.length, local: true });
    }

    for (let i = 0; i < sources.length && results.length < 30; i += CONCURRENCY) {
      if (cancellation.isCancelled()) break;
      const batch = sources.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (source) => {
          try {
            if (cancellation.isCancelled()) return null;
            const sourceEngine = new WebBookEngine(searchRequestOptions);
            const startedAt = Date.now();
            const books = await Promise.race<SearchBookResult[]>([
              sourceEngine.search(source, book.name),
              new Promise<SearchBookResult[]>((_, reject) => setTimeout(() => reject(new Error('超时')), SOURCE_TIMEOUT)),
            ]);
            await recordSourceHealth(source, Array.isArray(books) && books.length > 0, Date.now() - startedAt);
            const sourceUrl = source.book_source_url || source.bookSourceUrl;
            const isCurrentSource = String(sourceUrl || '') === String(book.origin || '');
            const matched = books.find(item => (isCurrentSource || item.bookUrl !== bookUrl) && isSameBook(item, book));
            if (!matched) return null;
            if (!isValidAuthor(matched.author)) {
              console.log(`[换源流式过滤] ${source.book_source_name || source.bookSourceName}: 《${matched.name}》作者无效(${matched.author})`);
              return null;
            }
            if (cancellation.isCancelled()) return null;
            const readable = await verifyReadableSwitchCandidate({
              engine: sourceEngine,
              source,
              book: matched,
              chapterIndex: currentChapterIndex,
              timeoutMs: Math.max(TOC_TIMEOUT, SOURCE_TIMEOUT),
            });
            if (!readable.readable && !shouldAllowUnverifiedSwitchCandidate(matched, book)) return null;
            return {
              ...buildAlternateSourceResult(matched, source, book),
              _tocVerified: readable.tocVerified,
              _contentVerified: readable.contentVerified,
              _readable: readable.readable,
              _tocCheckFailed: !readable.tocVerified,
            };
          } catch {
            await recordSourceHealth(source, false, SOURCE_TIMEOUT);
            return null;
          }
        })
      );

      for (const item of batchResults) {
        if (cancellation.isCancelled() || results.length >= 30) break;
        if (item.status !== 'fulfilled' || !item.value) continue;
        const value = item.value;
        const valueAggregateKey = getAggregateKey(value);
        if (results.some(r => r.bookUrl === value.bookUrl) || (valueAggregateKey && localAggregateKeys.has(valueAggregateKey))) continue;
        results.push(value);
        sendEvent({ type: 'result', data: value, count: results.length });
      }

      sendEvent({
        type: 'progress',
        searched: Math.min(i + CONCURRENCY, sources.length),
        total: sources.length,
        results: results.length,
      });
    }

    if (!cancellation.isCancelled()) {
      await setAlternateSourceCache(cacheKey, results.slice(0, 30), searchSettings.alternateSourceCacheTtlSeconds);
      sendEvent({ type: 'done', total: sources.length, results: results.length });
    }
  } catch (err: any) {
    if (!cancellation.isCancelled()) sendEvent({ type: 'error', msg: err.message });
  } finally {
    if (!res.destroyed && !res.writableEnded) res.end();
  }
}

// 切换当前书架书籍到新书源
export async function switchBookSource(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { oldBookUrl, newBook, chapterIndex } = req.body;
    if (!oldBookUrl || !newBook?.bookUrl) {
      res.json({ code: 400, msg: '缺少旧书籍或新书源信息' });
      return;
    }

    const currentChapterIndex = Number(chapterIndex ?? 0);
    const searchSettings = await getSearchSwitchSettings();
    const searchRequestOptions = buildSearchRequestOptions(searchSettings);
    const verifiedTarget = await verifySwitchTargetReadable(newBook, currentChapterIndex, {
      findSourceByUrl: (sourceUrl) => queryOne(
        'SELECT * FROM book_sources WHERE book_source_url = ? LIMIT 1',
        [sourceUrl]
      ),
      createEngine: () => new WebBookEngine(searchRequestOptions),
    });
    if (!verifiedTarget.ok) {
      res.json({ code: 400, msg: verifiedTarget.msg || '该书源目录不可用，已跳过切换' });
      return;
    }

    if (!user) {
      const readingSettings = await getReadingSettings();
      if (!canGuestUseSourceSwitch(currentChapterIndex, readingSettings.guestReadChapterLimit)) {
        res.json({
          code: 403,
          msg: '登录后继续换源',
          data: {
            requiresLogin: true,
            reason: 'guest_read_limit',
            guestReadChapterLimit: readingSettings.guestReadChapterLimit,
            chapterIndex: currentChapterIndex,
          },
        });
        return;
      }

      await getActiveCategories();
      const detectedCategory = autoDetectCategory({
        kind: newBook.kind,
        name: newBook.name,
        intro: newBook.intro,
      });
      await query(`
        INSERT INTO books (book_url, name, author, cover_url, intro, origin, origin_name, type, kind)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          author = VALUES(author),
          cover_url = VALUES(cover_url),
          intro = VALUES(intro),
          origin = VALUES(origin),
          origin_name = VALUES(origin_name),
          kind = VALUES(kind)
      `, [
        newBook.bookUrl,
        newBook.name || '',
        newBook.author || '',
        newBook.coverUrl || '',
        newBook.intro || '',
        newBook.sourceUrl || newBook.origin || '',
        newBook.sourceName || newBook.originName || '',
        newBook.kind || '',
      ]);

      await p