/**
 * 章节级换源服务
 *
 * 允许用户仅替换当前章节的来源，而不更换整本书的书源。
 * 这在当前书源某章节缺失或内容错误时特别有用。
 */

import { httpRequest, buildHeaders } from './bookSourceHttpClient';
import { WebBookEngine } from './webBookService';
import { setRuleExecutionContext } from './ruleExecutor';

export interface ChapterSwitchResult {
  /** 是否成功找到替代章节 */
  success: boolean;
  /** 替代章节内容 */
  content?: string;
  /** 替代章节标题 */
  title?: string;
  /** 替代章节 URL */
  url?: string;
  /** 目标书源信息 */
  targetSource?: {
    id: number;
    name: string;
    url: string;
  };
  /** 错误信息 */
  error?: string;
}

/**
 * 章节级换源
 *
 * 在目标书源中搜索同名书籍，获取其目录列表，
 * 按章节标题匹配定位对应章节，获取正文内容。
 *
 * @param currentSource 当前书源
 * @param targetSource 目标书源
 * @param bookName 书名
 * @param bookAuthor 作者
 * @param chapterTitle 当前章节标题
 * @param chapterIndex 当前章节索引
 */
export async function switchChapterSource(
  currentSource: any,
  targetSource: any,
  bookName: string,
  bookAuthor: string,
  chapterTitle: string,
  chapterIndex: number
): Promise<ChapterSwitchResult> {
  const targetName = targetSource.book_source_name || targetSource.bookSourceName || '未知';
  const targetUrl = targetSource.book_source_url || targetSource.bookSourceUrl || '';

  try {
    // 1. 在目标书源中搜索同名书籍
    const engine = new WebBookEngine();
    setRuleExecutionContext({
      sourceUrl: targetUrl,
      baseUrl: targetUrl,
      source: targetSource,
    });

    const searchResults = await engine.search(targetSource, bookName);
    if (searchResults.length === 0) {
      return { success: false, error: '在目标书源中未找到同名书籍' };
    }

    // 2. 匹配最相似的书籍（按书名和作者）
    const matchedBook = searchResults.find(
      (b) =>
        b.name === bookName ||
        (b.author && bookAuthor &&
          (b.author.includes(bookAuthor) || bookAuthor.includes(b.author)))
    ) || searchResults[0];

    // 3. 获取目标书源的目录列表
    const chapters = await engine.getChapterList(targetSource, matchedBook);
    if (chapters.length === 0) {
      return { success: false, error: '目标书源目录为空' };
    }

    // 4. 按章节标题匹配定位对应章节
    let targetChapter = findMatchingChapter(chapters, chapterTitle, chapterIndex);
    if (!targetChapter) {
      return { success: false, error: '未在目标书源中找到匹配的章节' };
    }

    // 5. 获取目标章节正文内容
    const content = await engine.getContent(targetSource, matchedBook, targetChapter);
    if (!content) {
      return { success: false, error: '获取目标章节内容失败' };
    }

    return {
      success: true,
      content,
      title: targetChapter.title,
      url: targetChapter.url,
      targetSource: {
        id: targetSource.id,
        name: targetName,
        url: targetUrl,
      },
    };
  } catch (e: any) {
    console.error(`[章节换源失败] ${targetName}:`, e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 查找匹配的章节
 *
 * 优先按标题精确匹配，其次按索引位置匹配
 */
function findMatchingChapter(
  chapters: any[],
  chapterTitle: string,
  chapterIndex: number
): any | null {
  if (chapters.length === 0) return null;

  const normalizedTitle = normalizeChapterTitle(chapterTitle);

  // 1. 精确标题匹配
  let match = chapters.find(
    (c) => normalizeChapterTitle(c.title) === normalizedTitle
  );
  if (match) return match;

  // 2. 包含关系匹配（目标章节标题包含当前章节标题）
  match = chapters.find((c) =>
    normalizeChapterTitle(c.title).includes(normalizedTitle)
  );
  if (match) return match;

  // 3. 反向包含匹配（当前章节标题包含目标章节标题）
  match = chapters.find((c) =>
    normalizedTitle.includes(normalizeChapterTitle(c.title))
  );
  if (match) return match;

  // 4. 按索引位置匹配（允许 +/- 2 的偏移）
  if (chapterIndex >= 0 && chapterIndex < chapters.length) {
    return chapters[chapterIndex];
  }
  if (chapterIndex - 1 >= 0 && chapterIndex - 1 < chapters.length) {
    return chapters[chapterIndex - 1];
  }
  if (chapterIndex + 1 >= 0 && chapterIndex + 1 < chapters.length) {
    return chapters[chapterIndex + 1];
  }

  // 5. 回退：返回相同比例的章节位置
  const ratio = chapterIndex / chapters.length;
  const fallbackIndex = Math.floor(ratio * chapters.length);
  return chapters[Math.min(fallbackIndex, chapters.length - 1)];
}

/**
 * 规范化章节标题（去除空格、数字前缀等）
 */
function normalizeChapterTitle(title: string): string {
  return title
    .replace(/^第[一二三四五六七八九十百千万零\d]+章[\s:]*/i, '')
    .replace(/^\d+[.、\s]+/, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

/**
 * 批量章节换源候选
 *
 * 在所有启用书源中搜索当前章节的替代来源
 */
export async function findChapterAlternatives(
  sources: any[],
  bookName: string,
  bookAuthor: string,
  chapterTitle: string,
  chapterIndex: number,
  concurrency: number = 5
): Promise<ChapterSwitchResult[]> {
  const results: ChapterSwitchResult[] = [];
  let idx = 0;

  async function next(): Promise<void> {
    while (idx < sources.length) {
      const i = idx++;
      const source = sources[i];
      try {
        const result = await switchChapterSource(
          null, source, bookName, bookAuthor, chapterTitle, chapterIndex
        );
        if (result.success) {
          results.push(result);
        }
      } catch (e: any) {
        console.error(`[章节换源候选] ${source.book_source_name}:`, e.message);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, sources.length) },
    () => next()
  );
  await Promise.all(workers);

  return results;
}
