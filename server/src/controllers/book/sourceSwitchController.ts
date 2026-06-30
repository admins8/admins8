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

/** 判断作者是否有效（非未知、非无作者，允许空作者通过） */
function isValidAuthor(author: any): boolean {
  const a = normalizeText(author);
  // 允许空作者通过验证（与首页搜索保持一致，不过滤空作者）
  if (!a) return true;
  const invalidPatterns = ['未知', '佚名', '无作者', '作者不详', '暂无作者', '未知作者', 'null', 'undefined', 'n/a'];
  return !invalidPatterns.some(p => a.includes(p));
}

export function isSameBook(candidate: SearchBookResult, book: any): boolean {
  const candidateName = normalizeText(candidate.name);
  const bookName = normalizeText(book.name);
  if (!candidateName || !bookName) return false;

  // 书名匹配：完全匹配或开头匹配（与首页搜索 getSearchMatchScore >= 80 保持一致）
  const nameMatch = candidateName === bookName
    || candidateName.startsWith(bookName)
    || bookName.startsWith(candidateName);
  if (!nameMatch) return false;

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
       WHERE enabled = 1 AND (last_check_status IS NULL OR last_check_status != 2)
       ORDER BY weight DESC, custom_order ASC`
    );
    const sources = await sortSourcesByHealth(rawSources);

    const CONCURRENCY = Math.min(Math.max(searchSettings.sourceSwitchConcurrency, 5), 15);
    // 换源场景单源超时4秒，平衡搜索覆盖和响应速度
    const SOURCE_TIMEOUT = Math.min(searchSettings.sourceSwitchTimeoutMs, 4000);
    const TOC_TIMEOUT = Math.min(searchSettings.sourceSwitchTocTimeoutMs, 6000);
    // 换源找到足够结果后提前停止（8个有效源）
    const EARLY_STOP_COUNT = 8;
    // 整轮搜索总超时15秒
    const TOTAL_TIMEOUT_MS = 15000;
    const results: any[] = [...localResults];
    const localAggregateKeys = new Set(localResults.map(item => getAggregateKey(item)).filter(Boolean));

    // 使用并发池模式：所有书源共享一个并发池，不等待批次完成，worker 持续取下一个
    let sourceIdx = 0;
    const workerCount = Math.min(CONCURRENCY, sources.length);

    async function worker(): Promise<void> {
      while (sourceIdx < sources.length) {
        // 早停：已找到足够多的有效源
        if (EARLY_STOP_COUNT > 0 && results.length >= EARLY_STOP_COUNT) break;
        const idx = sourceIdx++;
        const source = sources[idx];
        try {
          const sourceEngine = new WebBookEngine();
          const startedAt = Date.now();
          const books = await Promise.race<SearchBookResult[]>([
            sourceEngine.search(source, book.name),
            new Promise<SearchBookResult[]>((_, reject) => setTimeout(() => reject(new Error('超时')), SOURCE_TIMEOUT)),
          ]);
          await recordSourceHealth(source, Array.isArray(books) && books.length > 0, Date.now() - startedAt);
          const sourceUrl = source.book_source_url || source.bookSourceUrl;
          const isCurrentSource = String(sourceUrl || '') === String(book.origin || '');
          const matched = books.find(item => (isCurrentSource || item.bookUrl !== bookUrl) && isSameBook(item, book));
          if (!matched) continue;
          if (!isValidAuthor(matched.author)) {
            console.log(`[换源过滤] ${source.book_source_name || source.bookSourceName}: 《${matched.name}》作者无效(${matched.author})`);
            continue;
          }

          // 快速判断：书名+作者完全匹配的直接通过，不做 TOC 验证
          const candidateName = (matched.name || '').replace(/\s+/g, '').toLowerCase();
          const bookNameNorm = (book.name || '').replace(/\s+/g, '').toLowerCase();
          const candidateAuthor = (matched.author || '').replace(/\s+/g, '').toLowerCase();
          const bookAuthorNorm = (book.author || '').replace(/\s+/g, '').toLowerCase();
          const isExactMatch = candidateName === bookNameNorm
            && candidateAuthor === bookAuthorNorm
            && isValidAuthor(matched.author);

          let result: any;
          if (isExactMatch) {
            result = {
              ...buildAlternateSourceResult(matched, source, book),
              _tocVerified: false,
              _contentVerified: false,
              _readable: true,
              _tocCheckFailed: false,
              _pendingTocVerify: true,
            };
            // 后台异步验证 TOC（不阻塞返回）
            verifyReadableSwitchCandidate({
              engine: sourceEngine,
              source,
              book: matched,
              chapterIndex: currentChapterIndex,
              timeoutMs: TOC_TIMEOUT,
            }).then(readable => {
              result._tocVerified = readable.tocVerified;
              result._contentVerified = readable.contentVerified;
              result._readable = readable.readable;
              result._tocCheckFailed = !readable.tocVerified;
              result._pendingTocVerify = false;
            }).catch(() => {
              result._pendingTocVerify = false;
            });
          } else {
            const readable = await verifyReadableSwitchCandidate({
              engine: sourceEngine,
              source,
              book: matched,
              chapterIndex: currentChapterIndex,
              timeoutMs: TOC_TIMEOUT,
            });
            if (!readable.readable && !shouldAllowUnverifiedSwitchCandidate(matched, book)) continue;
            result = {
              ...buildAlternateSourceResult(matched, source, book),
              _tocVerified: readable.tocVerified,
              _contentVerified: readable.contentVerified,
              _readable: readable.readable,
              _tocCheckFailed: !readable.tocVerified,
            };
          }

          const valueAggregateKey = getAggregateKey(result);
          if (!results.some(r => r.bookUrl === result.bookUrl) && !(valueAggregateKey && localAggregateKeys.has(valueAggregateKey))) {
            results.push(result);
          }
        } catch {
          await recordSourceHealth(source, false, SOURCE_TIMEOUT);
        }
      }
    }

    // 整体搜索加总超时，避免worker堆积导致响应过慢
    const searchPromise = Promise.all(Array.from({ length: workerCount }, () => worker()));
    const totalTimeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('整体搜索超时')), TOTAL_TIMEOUT_MS)
    );
    try {
      await Promise.race([searchPromise, totalTimeoutPromise]);
    } catch {
      /* 总超时或异常，使用已收集的结果 */
    }

    results.sort((a, b) => Number(Boolean(b._local)) - Number(Boolean(a._local)) || Number(Boolean(b._tocVerified)) - Number(Boolean(a._tocVerified)) || b.matchScore - a.matchScore);
    await setAlternateSourceCache(cacheKey, results, searchSettings.alternateSourceCacheTtlSeconds);
    res.json({ code: 0, data: results });
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
       WHERE enabled = 1 AND (last_check_status IS NULL OR last_check_status != 2)
       ORDER BY weight DESC, custom_order ASC`
    );
    const sources = await sortSourcesByHealth(rawSources);

    // 解析排除列表（继续搜索时排除已找到的书源）
    const excludeParam = String(req.query.excludeBookUrls || '');
    const excludedUrls = new Set(excludeParam ? excludeParam.split(',').map(s => s.trim()).filter(Boolean) : []);

    sendEvent({ type: 'start', total: sources.length + localResults.length });

    const CONCURRENCY = Math.min(Math.max(searchSettings.sourceSwitchConcurrency, 5), 15);
    // 换源场景单源超时4秒，平衡搜索覆盖和响应速度
    const SOURCE_TIMEOUT = Math.min(searchSettings.sourceSwitchTimeoutMs, 4000);
    const TOC_TIMEOUT = Math.min(searchSettings.sourceSwitchTocTimeoutMs, 6000);
    // 每轮搜索找到8个有效源后停止，用户滚动可继续搜索下一批
    const EARLY_STOP_COUNT = 8;
    // 整轮搜索总超时15秒，防止worker堆积导致前端长时间等待
    const TOTAL_TIMEOUT_MS = 15000;
    const results: any[] = [];
    const localAggregateKeys = new Set(localResults.map(item => getAggregateKey(item)).filter(Boolean));
    for (const item of localResults) {
      results.push(item);
      sendEvent({ type: 'result', data: item, count: results.length, local: true });
    }

    // 使用并发池模式：所有书源共享一个并发池，worker 持续取下一个
    let sourceIdx = 0;
    let searchedCount = 0;
    const workerCount = Math.min(CONCURRENCY, sources.length);

    async function worker(): Promise<void> {
      while (sourceIdx < sources.length) {
        if (cancellation.isCancelled()) break;
        // 早停：已找到足够多的有效源，不再搜索剩余书源
        if (EARLY_STOP_COUNT > 0 && results.length >= EARLY_STOP_COUNT) break;
        const idx = sourceIdx++;
        const source = sources[idx];
        try {
          const sourceEngine = new WebBookEngine();
          const startedAt = Date.now();
          const books = await Promise.race<SearchBookResult[]>([
            sourceEngine.search(source, book.name),
            new Promise<SearchBookResult[]>((_, reject) => setTimeout(() => reject(new Error('超时')), SOURCE_TIMEOUT)),
          ]);
          await recordSourceHealth(source, Array.isArray(books) && books.length > 0, Date.now() - startedAt);
          const sourceUrl = source.book_source_url || source.bookSourceUrl;
          const isCurrentSource = String(sourceUrl || '') === String(book.origin || '');
          const matched = books.find(item => (isCurrentSource || item.bookUrl !== bookUrl) && isSameBook(item, book));
          if (!matched) continue;
          // 排除已找到的书源（继续搜索模式）
          if (excludedUrls.has(matched.bookUrl)) continue;
          if (!isValidAuthor(matched.author)) {
            console.log(`[换源流式过滤] ${source.book_source_name || source.bookSourceName}: 《${matched.name}》作者无效(${matched.author})`);
            continue;
          }
          if (cancellation.isCancelled()) break;

          // 快速判断：书名+作者完全匹配的直接通过，不做 TOC 验证
          const candidateName = (matched.name || '').replace(/\s+/g, '').toLowerCase();
          const bookNameNorm = (book.name || '').replace(/\s+/g, '').toLowerCase();
          const candidateAuthor = (matched.author || '').replace(/\s+/g, '').toLowerCase();
          const bookAuthorNorm = (book.author || '').replace(/\s+/g, '').toLowerCase();
          const isExactMatch = candidateName === bookNameNorm
            && candidateAuthor === bookAuthorNorm
            && isValidAuthor(matched.author);

          let result: any;
          if (isExactMatch) {
            result = {
              ...buildAlternateSourceResult(matched, source, book),
              _tocVerified: false,
              _contentVerified: false,
              _readable: true,
              _tocCheckFailed: false,
              _pendingTocVerify: true,
            };
            // 后台异步验证 TOC（不阻塞返回）
            verifyReadableSwitchCandidate({
              engine: sourceEngine,
              source,
              book: matched,
              chapterIndex: currentChapterIndex,
              timeoutMs: TOC_TIMEOUT,
            }).then(readable => {
              result._tocVerified = readable.tocVerified;
              result._contentVerified = readable.contentVerified;
              result._readable = readable.readable;
              result._tocCheckFailed = !readable.tocVerified;
              result._pendingTocVerify = false;
            }).catch(() => {
              result._pendingTocVerify = false;
            });
          } else {
            // 非精确匹配：需要 TOC 验证
            const readable = await verifyReadableSwitchCandidate({
              engine: sourceEngine,
              source,
              book: matched,
              chapterIndex: currentChapterIndex,
              timeoutMs: TOC_TIMEOUT,
            });
            if (!readable.readable && !shouldAllowUnverifiedSwitchCandidate(matched, book)) continue;
            result = {
              ...buildAlternateSourceResult(matched, source, book),
              _tocVerified: readable.tocVerified,
              _contentVerified: readable.contentVerified,
              _readable: readable.readable,
              _tocCheckFailed: !readable.tocVerified,
            };
          }

          const valueAggregateKey = getAggregateKey(result);
          if (!results.some(r => r.bookUrl === result.bookUrl) && !(valueAggregateKey && localAggregateKeys.has(valueAggregateKey))) {
            results.push(result);
            sendEvent({ type: 'result', data: result, count: results.length });
          }
        } catch {
          await recordSourceHealth(source, false, SOURCE_TIMEOUT);
        } finally {
          searchedCount++;
        }
      }
    }

    // 整体搜索加总超时，避免worker堆积导致前端长时间等待
    const searchPromise = Promise.all(Array.from({ length: workerCount }, () => worker()));
    const totalTimeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('整体搜索超时')), TOTAL_TIMEOUT_MS)
    );
    try {
      await Promise.race([searchPromise, totalTimeoutPromise]);
    } catch {
      /* 总超时或异常，使用已收集的结果 */
    }

    if (!cancellation.isCancelled()) {
      // 只有完整搜索时才写入缓存（继续搜索模式不写缓存）
      if (excludedUrls.size === 0) {
        await setAlternateSourceCache(cacheKey, results, searchSettings.alternateSourceCacheTtlSeconds);
      }
      // hasMore: 是否还有更多书源未搜索完（因早停或还有剩余书源）
      const hasMore = sourceIdx < sources.length;
      sendEvent({ type: 'done', total: sources.length, results: results.length, hasMore, searchedCount });
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

    // 规范化 URL：去除尾部斜杠和 # 后面的内容，统一协议
    function normalizeSourceUrl(url: string): string {
      return String(url || '')
        .trim()
        .replace(/#.*$/, '')
        .replace(/\/+$/, '')
        .replace(/^https?:\/\//, '');
    }

    let verifiedTarget;

    if (newBook._local) {
      // 本地已采集/缓存的书源：直接从数据库获取 TOC，跳过实时验证
      const localChapters = await query(
        'SELECT chapter_index, title, url FROM book_chapters WHERE book_url = ? ORDER BY chapter_index ASC',
        [newBook.bookUrl]
      );
      if (Array.isArray(localChapters) && localChapters.length > 0) {
        verifiedTarget = {
          ok: true,
          toc: localChapters.map((ch: any, i: number) => ({
            index: ch.chapter_index ?? i,
            title: ch.title,
            url: ch.url,
          })),
        };
        console.log(`[换源] 本地采集书源: ${newBook.sourceName}, TOC 共 ${localChapters.length} 章`);
      } else {
        verifiedTarget = { ok: false, msg: '本地书源目录为空' };
      }
    } else {
      verifiedTarget = await verifySwitchTargetReadable(newBook, currentChapterIndex, {
        findSourceByUrl: async (sourceUrl) => {
          const normalized = normalizeSourceUrl(sourceUrl);
          // 先尝试原始 URL 精确匹配
          let source = await queryOne(
            'SELECT * FROM book_sources WHERE book_source_url = ? LIMIT 1',
            [sourceUrl]
          );
          if (source) return source;
          // 再尝试规范化 URL 精确匹配（去除 #参数、尾部斜杠）
          source = await queryOne(
            'SELECT * FROM book_sources WHERE book_source_url = ? LIMIT 1',
            [normalized]
          );
          if (source) return source;
          // 最后尝试模糊匹配（忽略尾部斜杠、#参数、协议差异）
          const allSources = await query('SELECT * FROM book_sources WHERE enabled = 1');
          source = (allSources || []).find((s: any) => {
            const dbUrl = normalizeSourceUrl(s.book_source_url || s.bookSourceUrl);
            return dbUrl === normalized;
          });
          return source || null;
        },
        createEngine: () => new WebBookEngine(),
      });
    }

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

      await persistVerifiedSwitchData(newBook.bookUrl, verifiedTarget);
      res.json({ code: 0, msg: '换源成功', data: { bookUrl: newBook.bookUrl } });
      return;
    }

    const oldShelf = await queryOne(
      'SELECT * FROM user_books WHERE user_id = ? AND book_url = ?',
      [user.userId, oldBookUrl]
    );
    if (!oldShelf) {
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
      await persistVerifiedSwitchData(newBook.bookUrl, verifiedTarget);
      res.json({ code: 0, msg: '换源成功', data: { bookUrl: newBook.bookUrl, shelfUpdated: false } });
      return;
    }

    await transaction(async (conn) => {
      await getActiveCategories();
      const detectedCategory = autoDetectCategory({
        kind: newBook.kind,
        name: newBook.name,
        intro: newBook.intro,
      });
      await conn.execute(`
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

      const existingNewShelf: any = await conn.execute(
        'SELECT id FROM user_books WHERE user_id = ? AND book_url = ?',
        [user.userId, newBook.bookUrl]
      );
      const rows = existingNewShelf[0] as any[];

      if (rows.length > 0 && oldBookUrl !== newBook.bookUrl) {
        await conn.execute(
          `UPDATE user_books
           SET dur_chapter_index = ?, dur_chapter_pos = ?, dur_chapter_title = ?, dur_chapter_time = NOW()
           WHERE user_id = ? AND book_url = ?`,
          [
            oldShelf.dur_chapter_index || 0,
            oldShelf.dur_chapter_pos || 0,
            oldShelf.dur_chapter_title || '',
            user.userId,
            newBook.bookUrl,
          ]
        );
        await conn.execute('DELETE FROM user_books WHERE user_id = ? AND book_url = ?', [user.userId, oldBookUrl]);
      } else {
        await conn.execute(
          `UPDATE user_books
           SET book_url = ?, dur_chapter_time = NOW()
           WHERE user_id = ? AND book_url = ?`,
          [newBook.bookUrl, user.userId, oldBookUrl]
        );
      }
    });

    await persistVerifiedSwitchData(newBook.bookUrl, verifiedTarget);
    res.json({ code: 0, msg: '换源成功', data: { bookUrl: newBook.bookUrl } });
  } catch (err: any) {
    sendError(res, err, '换源失败');
    return;
  }
}

// ========== 章节级换源 ==========

import { switchChapterSource, findChapterAlternatives } from '../../services/chapterSwitchService';

/**
 * 章节级换源 — 仅替换单章内容，不更换整本书的书源
 * POST /api/book/chapter-switch
 */
export async function switchChapter(req: Request, res: Response): Promise<void> {
  try {
    const { bookName, bookAuthor, chapterTitle, chapterIndex, targetSourceId } = req.body;

    if (!bookName || !chapterTitle) {
      res.json({ code: 400, msg: '缺少必要参数：bookName, chapterTitle' });
      return;
    }

    // 获取目标书源
    const targetSource = await queryOne('SELECT * FROM book_sources WHERE id = ? AND enabled = 1', [
      targetSourceId,
    ]);
    if (!targetSource) {
      res.json({ code: 404, msg: '目标书源不存在或未启用' });
      return;
    }

    const result = await switchChapterSource(
      null,
      targetSource,
      bookName,
      bookAuthor || '',
      chapterTitle,
      chapterIndex || 0
    );

    if (result.success) {
      res.json({ code: 0, data: result });
    } else {
      res.json({ code: 500, msg: result.error || '章节换源失败' });
    }
  } catch (err: any) {
    sendError(res, err, '章节换源失败');
  }
}

/**
 * 批量查找章节替代来源（流式推送）
 * POST /api/book/chapter-alternatives-stream
 */
export async function streamChapterAlternatives(req: Request, res: Response): Promise<void> {
  const { bookName, bookAuthor, chapterTitle, chapterIndex } = req.body;

  if (!bookName || !chapterTitle) {
    res.json({ code: 400, msg: '缺少必要参数：bookName, chapterTitle' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 获取所有启用的书源
    const sources = await query(
      'SELECT * FROM book_sources WHERE enabled = 1 AND search_url IS NOT NULL AND search_url != \'\' ORDER BY weight DESC, custom_order ASC'
    );

    sendEvent('total', { total: sources.length });

    let found = 0;

    // 并发搜索，找到即推送（无上限，搜索所有启用书源）
    let idx = 0;
    const concurrency = 5;

    async function next(): Promise<void> {
      while (idx < sources.length) {
        const i = idx++;
        const source = sources[i];
        try {
          const result = await switchChapterSource(
            null,
            source,
            bookName,
            bookAuthor || '',
            chapterTitle,
            chapterIndex || 0
          );
          if (result.success) {
            found++;
            sendEvent('result', result);
          }
        } catch (e: any) {
          // 忽略单个书源的失败
        }
        sendEvent('progress', { current: i + 1, total: sources.length, found });
      }
    }

    const workers = Array.from(
      { length: Math.min(concurrency, sources.length) },
      () => next()
    );
    await Promise.all(workers);

    sendEvent('done', { total: sources.length, found });
    res.end();
  } catch (err: any) {
    sendEvent('error', { msg: err.message });
    res.end();
  }
}

// 刷新目录
