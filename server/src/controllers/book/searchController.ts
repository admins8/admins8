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
import { aggregateSearchResults, classifySearchResult, getAggregateKey, getSearchMatchScore, getSearchWindow, rankSearchResults, shouldEmitImmediateSearchResult } from '../../services/searchResultRanking';
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

export function isKnownUnreadableSearchCandidate(source: any, book: any): boolean {
  const sourceName = String(source?.book_source_name || source?.source_name || book?.sourceName || '').toLowerCase();
  const bookUrl = String(book?.bookUrl || book?.book_url || '').toLowerCase();
  const sourceUrl = String(source?.book_source_url || book?.sourceUrl || '').toLowerCase();
  if (sourceName.includes('喜马拉雅') || sourceName.includes('ximalaya')) return true;
  if (sourceName.includes('污书屋') || bookUrl.includes('miaoquan2016.com') || sourceUrl.includes('miaoquan2016.com')) return true;
  if (sourceName.includes('蚂蚁阅读') || bookUrl.includes('wap.mayitxt.org') || sourceUrl.includes('wap.mayitxt.org')) return true;
  if (sourceName.includes('猫眼看书') || bookUrl.includes('api.jmlldsc.com') || sourceUrl.includes('api.jmlldsc.com')) return true;
  if (
    sourceName.includes('qq阅读') ||
    sourceName.includes('企鹅') ||
    bookUrl.includes('detailadr.reader.qq.com') ||
    bookUrl.includes('novel.html5.qq.com') ||
    bookUrl.includes('bookshelf.html5.qq.com') ||
    bookUrl.includes('ubook.reader.qq.com') ||
    sourceUrl.includes('detailadr.reader.qq.com') ||
    sourceUrl.includes('novel.html5.qq.com') ||
    sourceUrl.includes('bookshelf.html5.qq.com') ||
    sourceUrl.includes('ubook.reader.qq.com')
  ) return true;
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

export async function searchBooks(req: Request, res: Response): Promise<void> {
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
  const searchSlot = await acquireSearchSlot(config.search.globalConcurrency);
  if (!searchSlot.acquired) {
    sendEvent({ type: 'error', code: 429, msg: searchSlot.message || '当前搜索人数较多，请稍后' });
    res.end();
    return;
  }

  try {
    const user = (req as any).user;
    if (!user) {
      const readingSettings = await getReadingSettings();
      if (!readingSettings.guestSearchEnabled) {
        sendEvent({
          type: 'error',
          code: 403,
          reason: 'login_required',
          msg: '请先登录后再搜索书籍',
        });
        res.end();
        return;
      }
    }

    const { keyword, key, author } = req.query;
    const searchKey = keyword || key || '';
    const referenceAuthor = author ? String(author) : undefined;
    if (!searchKey) {
      sendEvent({ type: 'error', msg: '缺少搜索关键词' });
      res.end();
      return;
    }

    // 参数说明：
    //   startIndex: 从第几个书源开始（0-based）
    //   targetCount: 想要多少条有效结果（默认无上限，搜索所有启用书源）
    //   传 0 或不传表示无上限，搜索所有书源
    const startIndex = Math.max(0, parseInt(String(req.query.startIndex || '0'), 10) || 0);
    const rawTargetCount = parseInt(String(req.query.targetCount || req.query.batchSize || '0'), 10) || 0;
    const targetCount = rawTargetCount > 0 ? rawTargetCount : 0; // 0 = 无上限
    const forceRefresh = req.query.force === '1' || req.query.refresh === '1';
    const forceVerifyToc = req.query.verifyToc === '1' || req.query.verifyToc === 'true';
    const searchMode = req.query.mode === 'switch' ? 'switch' : 'normal';

    const searchSettings = await getSearchSwitchSettings();
    const searchRequestOptions = buildSearchRequestOptions(searchSettings);
    const transportCacheVersion = getSearchTransportCacheVersion(searchSettings);

    // 加载所有启用的书源（按权重优先，再按健康度动态排序）
    const rawSources = await query(
      "SELECT id, book_source_url, book_source_name, search_url, rule_search, rule_toc, header, enabled_cookie_jar, concurrent_rate, js_lib, weight, custom_order, last_check_status FROM book_sources WHERE enabled = 1 ORDER BY weight DESC, custom_order ASC"
    );
    const sources = await sortSourcesByHealth(rawSources);

    const scanCount = Math.max(
      50,
      Math.min(
        300,
        parseInt(String(req.query.scanCount || req.query.maxScanCount || (searchMode === 'switch' ? '200' : '150')), 10) || (searchMode === 'switch' ? 200 : 150)
      )
    );
    const searchWindow = getSearchWindow(sources, startIndex, scanCount);
    const totalSources = searchWindow.totalSources;
    const remainingSources = searchWindow.remainingSources;
    const normalizedKey = String(searchKey).trim().toLowerCase().replace(/\s+/g, ' ');

    sendEvent({
      type: 'start',
      total: totalSources,
      batchStart: startIndex,
      targetCount,
      hasMore: searchWindow.hasMore,
    });

    // --- 优先返回本地已采集书库（跨缓存命中前置）---
    const preEmittedSeenBookUrls = new Set<string>();
    const preEmittedAggregateKeys = new Set<string>();
    let preEmittedLocalCount = 0;
    if (startIndex === 0 && searchMode === 'normal') {
      try {
        const cleanKwForLocal = String(searchKey || '').trim().toLowerCase().replace(/[\s\p{P}]/gu, '');
        const localRows = await query(
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
                  word_count AS wordCount,
                  total_chapter_num AS totalChapterNum
             FROM books
            WHERE LOWER(REPLACE(name, ' ', '')) = ?
               OR name LIKE ?
            ORDER BY updated_at DESC
            LIMIT ?`,
          [cleanKwForLocal, `%${String(searchKey || '').trim()}%`, targetCount > 0 ? targetCount : 10000]
        );
        const localRanked = rankSearchResults(String(searchKey || ''), localRows || []);
        for (const row of localRanked) {
          if (targetCount > 0 && preEmittedLocalCount >= targetCount) break;
          const match = classifySearchResult(String(searchKey || ''), row, referenceAuthor);
          if (match.level === 'none' || match.level === 'weak') continue;
          const bookUrl = String(row.bookUrl || '').trim();
          if (!bookUrl || preEmittedSeenBookUrls.has(bookUrl)) continue;
          preEmittedSeenBookUrls.add(bookUrl);
          const aggKey = getAggregateKey(row);
          preEmittedAggregateKeys.add(aggKey);
          const book = {
            ...row,
            sourceName: row.sourceName || '本地书库',
            _local: true,
            _readable: true,
            _tocVerified: true,
            _matchLevel: match.level,
            _matchLabel: match.label,
            _matchScore: match.score,
            _aggregateKey: aggKey,
            sourceCount: 1,
            sources: [{
              bookUrl,
              sourceUrl: row.sourceUrl || '',
              sourceName: row.sourceName || '本地书库',
              coverUrl: row.coverUrl,
              intro: row.intro,
              kind: row.kind,
              latestChapterTitle: row.latestChapterTitle,
              wordCount: row.wordCount,
              type: row.type,
              _tocVerified: true,
              _readable: true,
              _matchLevel: match.level,
              _matchLabel: match.label,
              _matchScore: match.score,
            }],
          };
          preEmittedLocalCount += 1;
          sendEvent({ type: 'result', data: book, count: preEmittedLocalCount, local: true });
        }
      } catch (localErr: any) {
        console.log('[搜索本地书库-前置] 跳过:', localErr?.message);
      }
    }

    // --- 缓存检查（如果不是强制刷新）---
    const cache = await getSearchCache();
    if (!forceRefresh && !forceVerifyToc) {
      try {
        let kwHash = 0;
        for (let i = 0; i < normalizedKey.length; i++) {
          kwHash = ((kwHash << 5) - kwHash) + normalizedKey.charCodeAt(i);
          kwHash |= 0;
        }
        const batchCacheKey = `legado:search:v18:${transportCacheVersion}:${Math.abs(kwHash).toString(36)}:${startIndex}:${targetCount}:${totalSources}`;
        if (cache && (cache as any).client) {
          const cachedRaw = await (cache as any).client.get(batchCacheKey);
          if (cachedRaw) {
            const batchData = JSON.parse(cachedRaw);
            const batchResults = batchData?.results || [];
            const cachedSearchedTo = batchData?.searchedTo ?? Math.min(startIndex + 100, totalSources);

            // 缓存命中后也做一次书名与关键词的交叉校验（防止旧缓存里的错书残留）
            const cleanKw = String(searchKey || '').trim().toLowerCase().replace(/[\s\p{P}]/gu, '');
            let realCount = preEmittedLocalCount;
            for (const book of batchResults) {
              const nameClean = String(book?.name || '').trim().toLowerCase().replace(/[\s\p{P}]/gu, '');
              if (cleanKw && nameClean) {
                const hasRelation = nameClean === cleanKw
                  || nameClean.includes(cleanKw)
                  || nameClean.startsWith(cleanKw)
                  || (cleanKw.length >= 4 && (() => {
                      const minLen = Math.max(2, Math.floor(cleanKw.length * 0.7));
                      for (let k = 0; k <= cleanKw.length - minLen; k++) {
                        if (nameClean.includes(cleanKw.slice(k, k + minLen))) return true;
                      }
                      return false;
                    })());
                if (!hasRelation) continue;
              }
              // 与已经返回的本地书去重（按 bookUrl 与 name|author 聚合键）
              const cachedBookUrl = String(book?.bookUrl || '').trim();
              if (cachedBookUrl && preEmittedSeenBookUrls.has(cachedBookUrl)) continue;
              const cachedAggKey = getAggregateKey(book || {});
              if (cachedAggKey && preEmittedAggregateKeys.has(cachedAggKey)) continue;
              realCount += 1;
              sendEvent({ type: 'result', data: { ...book, _cached: true }, count: realCount, cached: true });
            }

            const stillHasMore = cachedSearchedTo < totalSources;
            sendEvent({
              type: 'done',
              total: totalSources,
              searched: cachedSearchedTo,
              results: realCount,
              hasMore: stillHasMore,
              batchStart: startIndex,
              cached: true,
            });
            await recordUserSearch({
              userId: user?.userId,
              keyword: String(searchKey),
              resultCount: realCount,
              ipAddress: req.ip,
            });
            console.log(`[搜索缓存命中] 关键词:"${searchKey}" 起:${startIndex} 止:${cachedSearchedTo} 结果:${realCount}/${batchResults.length}`);
            return;
          }
        }
      } catch (cacheErr: any) {
        console.log('[搜索缓存读取] 跳过:', cacheErr?.message);
      }
    }

    // --- 实时搜索：持续并发搜索书源，直到凑够 targetCount 条有效结果 ---
    const rawResults: any[] = [];
    const emittedResults: any[] = [];
    const seenBookUrls = new Set<string>();
    const emittedAggregateSourceCounts = new Map<string, number>();
    const CONCURRENCY = Math.max(1, searchMode === 'switch'
      ? searchSettings.sourceSwitchConcurrency
      : searchSettings.searchSourceConcurrency);       // 每轮并发书源请求数
    const SOURCE_TIMEOUT = searchMode === 'switch'
      ? Math.min(searchSettings.sourceSwitchTimeoutMs, 12000)
      : Math.min(searchSettings.searchSourceTimeoutMs, 8000);
    const TOC_TIMEOUT = searchMode === 'switch'
      ? Math.min(searchSettings.sourceSwitchTocTimeoutMs, 12000)
      : Math.min(searchSettings.searchTocTimeoutMs, 8000);
    const cleanKw = String(searchKey || '').trim().toLowerCase().replace(/[\s\p{P}]/gu, '');

    // 记录实际搜索到的书源索引（用于缓存与"继续搜索"的起点）
    let searchedToIndex = startIndex;

    if (startIndex === 0 && searchMode === 'normal') {
      try {
        const localRows = await query(
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
                  word_count AS wordCount,
                  total_chapter_num AS totalChapterNum
             FROM books
            WHERE LOWER(REPLACE(name, ' ', '')) = ?
               OR name LIKE ?
            ORDER BY updated_at DESC
            LIMIT ?`,
          [cleanKw, `%${String(searchKey || '').trim()}%`, targetCount]
        );
        const localRanked = rankSearchResults(String(searchKey || ''), localRows || []);
        for (const row of localRanked) {
          if (targetCount > 0 && emittedResults.length >= targetCount) break;
          const match = classifySearchResult(String(searchKey || ''), row, referenceAuthor);
          if (match.level === 'none' || match.level === 'weak') continue;
          const bookUrl = String(row.bookUrl || '').trim();
          if (!bookUrl || seenBookUrls.has(bookUrl)) continue;
          seenBookUrls.add(bookUrl);
          const aggKey = getAggregateKey(row);
          const book = {
            ...row,
            sourceName: row.sourceName || '本地书库',
            _local: true,
            _readable: true,
            _tocVerified: true,
            _matchLevel: match.level,
            _matchLabel: match.label,
            _matchScore: match.score,
            _aggregateKey: aggKey,
            sourceCount: 1,
            sources: [{
              bookUrl,
              sourceUrl: row.sourceUrl || '',
              sourceName: row.sourceName || '本地书库',
              coverUrl: row.coverUrl,
              intro: row.intro,
              kind: row.kind,
              latestChapterTitle: row.latestChapterTitle,
              wordCount: row.wordCount,
              type: row.type,
              _tocVerified: true,
              _readable: true,
              _matchLevel: match.level,
              _matchLabel: match.label,
              _matchScore: match.score,
            }],
          };
          emittedAggregateSourceCounts.set(book._aggregateKey, 1);
          emittedResults.push(book);
          rawResults.push(book);
          // 已在前置阶段发送过的本地书不再重复推送，仅做内部状态同步
          if (!preEmittedSeenBookUrls.has(bookUrl)) {
            sendEvent({ type: 'result', data: book, count: emittedResults.length, local: true });
          }
        }
      } catch (localErr: any) {
        console.log('[搜索本地书库] 跳过:', localErr?.message);
      }
    }

    const processSource = async (source: any): Promise<any | null> => {
      try {
        if (cancellation.isCancelled()) return null;
        const sourceEngine = new WebBookEngine();
        const startedAt = Date.now();
        const books = await Promise.race<SearchBookResult[]>([
          sourceEngine.search(source, String(searchKey || '').trim()),
          new Promise<SearchBookResult[]>((_, reject) => setTimeout(() => reject(new Error('超时')), SOURCE_TIMEOUT))
        ]);
        await recordSourceHealth(source, Array.isArray(books) && books.length > 0, Date.now() - startedAt);
        if (!Array.isArray(books) || books.length === 0) return null;

        let bestBook: SearchBookResult | null = null;
        let bestScore = 0;
        for (const cand of books) {
          if (!cand?.name) continue;
          const nameClean = String(cand.name).trim().toLowerCase().replace(/[\s\p{P}]/gu, '');
          if (!nameClean || !cleanKw) continue;
          const score = getSearchMatchScore(String(searchKey || ''), cand.name);
          if (score > bestScore) {
            bestScore = score;
            bestBook = cand;
            if (score >= 100) break;
          }
        }
        if (!bestBook || bestScore < 1) return null;
        if (isKnownUnreadableSearchCandidate(source, bestBook)) return null;
        if (cancellation.isCancelled()) return null;

        const match = classifySearchResult(String(searchKey || ''), bestBook, referenceAuthor);
        if (match.level === 'none' || match.level === 'weak') return null;
        const readability = forceVerifyToc
          ? await verifyReadableBookCandidate({
              engine: sourceEngine,
              source,
              book: bestBook,
              timeoutMs: Math.max(TOC_TIMEOUT, SOURCE_TIMEOUT),
            })
          : { readable: false, tocVerified: false, contentVerified: false };
        const verified = readability.tocVerified;
        if (!readability.readable && forceVerifyToc) return null;
        return {
          ...bestBook,
          sourceUrl: source.book_source_url || source.bookSourceUrl,
          sourceName: source.book_source_name || source.bookSourceName,
          _tocVerified: verified,
          _contentVerified: readability.contentVerified,
          _readable: readability.readable,
          _searchQuality: readability.tocVerified ? 'toc-verified' : 'unverified',
          _tocCheckFailed: !verified,
          _matchLevel: match.level,
          _matchLabel: match.label,
          _matchScore: match.score,
        };
      } catch (e: any) {
        await recordSourceHealth(source, false, SOURCE_TIMEOUT);
        return null;
      }
    };

    const emitAggregatedResults = () => {
      const aggregatedBatchResults = aggregateSearchResults(String(searchKey || ''), rawResults);
      for (const book of aggregatedBatchResults) {
        if (!shouldEmitImmediateSearchResult(book, { forceVerifyToc })) continue;
        const previousCount = emittedAggregateSourceCounts.get(book._aggregateKey) || 0;
        if (book.sourceCount > previousCount) {
          emittedAggregateSourceCounts.set(book._aggregateKey, book.sourceCount);
          const existingIndex = emittedResults.findIndex((item) => item._aggregateKey === book._aggregateKey);
          if (existingIndex >= 0) {
            emittedResults[existingIndex] = book;
          } else {
            emittedResults.push(book);
          }
          sendEvent({ type: 'result', data: book, count: emittedResults.length });
        }
      }
    };

    let sourceCursor = 0;
    let completedSources = 0;
    const workerCount = Math.min(CONCURRENCY, remainingSources.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (!cancellation.isCancelled()) {
        if (targetCount > 0 && emittedResults.length >= targetCount) return;
        const idx = sourceCursor++;
        if (idx >= remainingSources.length) return;
        const book = await processSource(remainingSources[idx]);
        completedSources++;
        searchedToIndex = Math.max(searchedToIndex, startIndex + idx + 1);
        if (book) {
          for (const rankedBook of rankSearchResults(String(searchKey || ''), [book])) {
            if (rankedBook.bookUrl && !seenBookUrls.has(rankedBook.bookUrl)) {
              seenBookUrls.add(rankedBook.bookUrl);
              rawResults.push(rankedBook);
            }
          }
          emitAggregatedResults();
        }
        if (completedSources % Math.max(1, Math.floor(CONCURRENCY / 2)) === 0 || book) {
          sendEvent({
            type: 'progress',
            searched: searchedToIndex,
            total: totalSources,
            results: emittedResults.length,
            batchStart: startIndex,
          });
        }
      }
    });
    await Promise.allSettled(workers);

    if (cancellation.isCancelled()) return;
    emitAggregatedResults();

    if (cancellation.isCancelled()) return;
    const finalResults = aggregateSearchResults(
      String(searchKey || ''),
      rawResults
    );
    for (const book of finalResults) {
      if (targetCount > 0 && emittedResults.length >= targetCount) break;
      if (book._matchLevel !== 'exact') continue;
      if (forceVerifyToc && !book._readable) continue;
      const previousCount = emittedAggregateSourceCounts.get(book._aggregateKey) || 0;
      if (book.sourceCount > previousCount) {
        emittedAggregateSourceCounts.set(book._aggregateKey, book.sourceCount);
        const existingIndex = emittedResults.findIndex((item) => item._aggregateKey === book._aggregateKey);
        if (existingIndex >= 0) {
          emittedResults[existingIndex] = book;
        } else {
          emittedResults.push(book);
        }
        sendEvent({ type: 'result', data: { ...book, _fallback: !book._readable }, count: emittedResults.length });
      }
    }

    // --- 写入缓存（记录本轮搜索到的位置与结果）---
    try {
      if (!cancellation.isCancelled() && cache && (cache as any).client) {
        let kwHash = 0;
        for (let i = 0; i < normalizedKey.length; i++) {
          kwHash = ((kwHash << 5) - kwHash) + normalizedKey.charCodeAt(i);
          kwHash |= 0;
        }
        const batchCacheKey = `legado:search:v18:${transportCacheVersion}:${Math.abs(kwHash).toString(36)}:${startIndex}:${targetCount}:${totalSources}`;
        const ttl = (cache as any).options?.ttlSeconds || 600;
        await (cache as any).client.setEx(
          batchCacheKey, ttl,
          JSON.stringify({ results: finalResults, batchStart: startIndex, searchedTo: searchedToIndex, totalSources, keyword: searchKey })
        );
      }
    } catch (cacheErr: any) {
      console.log('[搜索缓存写入] 跳过:', cacheErr?.message);
    }

    const hasMore = searchedToIndex < totalSources;
    if (cancellation.isCancelled()) return;
    sendEvent({
      type: 'done',
      total: totalSources,
      searched: searchedToIndex,
      results: emittedResults.length,
      hasMore,
      batchStart: startIndex,
      cached: false,
    });
    await recordUserSearch({
      userId: user?.userId,
      keyword: String(searchKey),
      resultCount: emittedResults.length,
      ipAddress: req.ip,
    });
    console.log(`[搜索完成] 关键词:"${searchKey}" 书源:${startIndex}-${searchedToIndex}/${totalSources} 结果:${emittedResults.length} 目标:${targetCount} hasMore:${hasMore}`);
  } catch (err: any) {
    if (!cancellation.isCancelled()) sendEvent({ type: 'error', msg: err.message });
  } finally {
    await searchSlot.release();
    if (!res.destroyed && !res.writableEnded) res.end();
  }
}

// 获取当前书籍的可换书源
