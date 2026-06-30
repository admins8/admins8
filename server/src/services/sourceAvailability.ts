import type { ChapterResult } from './webBookService';

export interface ChapterListEngine {
  getChapterList(source: any, book: any): Promise<ChapterResult[]>;
}

export function isUsableChapter(chapter: any): boolean {
  const title = String(chapter?.title || '').trim();
  const url = String(chapter?.url || '').trim();
  if (!title || !url) return false;
  if (title.includes('@') || title.includes('{') || title.includes('}') || title.includes('<') || title.includes('>')) return false;
  if (title.includes('.*?') || title.includes('(?')) return false;
  if (/^(首页|书库|排行|排行榜|完本|足迹|历史|登录|注册|搜索|分类|返回|上一页|下一页)$/.test(title)) return false;
  // 放宽标题匹配：只要不是明显的导航/广告标题即可
  if (/^(目录|章节目录|全文阅读|加入书架|开始阅读|立即阅读|最新章节|TXT下载|举报)$/.test(title)) return false;
  return true;
}

/**
 * 判断书源返回的书籍是否具备有效章节（至少 10 条非空章节标题）。
 * 不足 10 章的书源结果将被跳过，不返回给前端，避免展示无内容的匹配。
 */
export async function hasAvailableChapters(
  engine: ChapterListEngine,
  source: any,
  book: any,
  timeoutMs = 6000,
  minChapters = 10
): Promise<boolean> {
  try {
    const chapters = await Promise.race([
      engine.getChapterList(source, book),
      new Promise<ChapterResult[]>((_, reject) => {
        setTimeout(() => reject(new Error(`toc timeout of ${timeoutMs}ms exceeded`)), timeoutMs);
      }),
    ]);

    if (!Array.isArray(chapters) || chapters.length < minChapters) return false;
    let validCount = 0;
    for (const chapter of chapters) {
      if (isUsableChapter(chapter)) {
        validCount++;
        if (validCount >= minChapters) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
