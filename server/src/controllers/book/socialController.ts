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
import { toggleAuthorFollow, isAuthorFollowed, getAuthorFollowerCount } from '../../services/authorFollowService';
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

export async function getComments(req: Request, res: Response): Promise<void> {
  try {
    const { bookUrl } = req.query;
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少书籍地址' });
      return;
    }
    res.json({ code: 0, data: await getBookComments(String(bookUrl)) });
  } catch (err: any) {
    sendError(res, err, '社交操作失败');
    return;
  }
}

export async function addComment(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { bookUrl, content } = req.body;
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少书籍地址' });
      return;
    }
    res.json({ code: 0, data: await createBookComment(user.userId, String(bookUrl), content), msg: '评论成功' });
  } catch (err: any) {
    sendError(res, err, '社交操作失败');
    return;
  }
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    await deleteBookComment(user.userId, Number(req.body.id));
    res.json({ code: 0, msg: '评论已删除' });
  } catch (err: any) {
    sendError(res, err, '社交操作失败');
    return;
  }
}

export async function toggleLike(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { bookUrl } = req.body;
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少书籍地址' });
      return;
    }
    res.json({ code: 0, data: await toggleBookLike(user.userId, String(bookUrl)) });
  } catch (err: any) {
    sendError(res, err, '社交操作失败');
    return;
  }
}

export async function getSocialStats(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    res.json({
      code: 0,
      data: await getBookSocialStats(req.query, user?.userId),
    });
  } catch (err: any) {
    sendError(res, err, '社交操作失败');
    return;
  }
}

// 作者关注
export async function toggleAuthorFollowHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { authorName } = req.body;
    if (!authorName) {
      res.json({ code: 400, msg: '缺少作者名称' });
      return;
    }
    res.json({ code: 0, data: await toggleAuthorFollow(user.userId, String(authorName)) });
  } catch (err: any) {
    sendError(res, err, '关注操作失败');
  }
}

export async function getAuthorFollowStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { authorName } = req.query;
    if (!authorName) {
      res.json({ code: 400, msg: '缺少作者名称' });
      return;
    }
    const name = String(authorName);
    const [followed, followerCount] = await Promise.all([
      isAuthorFollowed(user?.userId, name),
      getAuthorFollowerCount(name),
    ]);
    res.json({ code: 0, data: { followed, followerCount } });
  } catch (err: any) {
    sendError(res, err, '获取关注状态失败');
  }
}

export async function getMyFollowedAuthors(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const authors = await query(
      `SELECT author_name AS name, created_at AS followedAt,
              (SELECT COUNT(*) FROM author_follows f2 WHERE f2.author_name = f.author_name) AS followerCount
       FROM author_follows f
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [user.userId]
    );
    res.json({ code: 0, data: authors });
  } catch (err: any) {
    sendError(res, err, '获取关注列表失败');
  }
}

// 获取章节列表
