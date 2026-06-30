import { isUsableChapter } from './sourceAvailability';

export interface SwitchSourceVerificationDeps {
  findSourceByUrl(sourceUrl: string): Promise<any>;
  createEngine(): {
    getBookInfo(source: any, book: any): Promise<any>;
    getChapterList(source: any, book: any): Promise<any[]>;
    getContent?(source: any, book: any, chapter: any): Promise<string | null>;
  };
}

export async function verifySwitchTargetReadable(
  newBook: any,
  chapterIndex: number,
  deps: SwitchSourceVerificationDeps
) {
  const sourceUrl = newBook?.sourceUrl || newBook?.origin;
  if (!sourceUrl || !newBook?.bookUrl) {
    return { ok: false, msg: '新书源信息不完整' };
  }

  const source = await deps.findSourceByUrl(sourceUrl);
  if (!source) {
    return { ok: false, msg: '新书源不存在或已被禁用' };
  }

  const engine = deps.createEngine();

  // 先获取书籍详情，从中提取真正的目录页 URL（tocUrl）
  // 很多书源的 bookUrl（详情页）和 tocUrl（目录页）是不同的
  let tocUrl = newBook.bookUrl;
  try {
    const info = await engine.getBookInfo(source, {
      book_url: newBook.bookUrl,
      bookUrl: newBook.bookUrl,
      origin: sourceUrl,
    });
    if (info) {
      // bookInfo 可能返回 tocUrl / toc_url 字段
      if (info.tocUrl || info.toc_url) {
        tocUrl = info.tocUrl || info.toc_url;
      }
    }
  } catch (e: any) {
    console.log(`[换源验证] getBookInfo 失败，使用 bookUrl 作为 tocUrl: ${e.message}`);
  }

  const toc = await engine.getChapterList(source, {
    ...newBook,
    book_url: newBook.bookUrl,
    bookUrl: newBook.bookUrl,
    toc_url: tocUrl,
    tocUrl: tocUrl,
    origin: sourceUrl,
  });
  const usableToc = Array.isArray(toc) ? toc.filter(isUsableChapter) : [];
  if (usableToc.length < 1) {
    // 如果过滤后无可用章节，尝试使用原始目录（不过滤）
    if (Array.isArray(toc) && toc.length > 0) {
      return { ok: true, toc };
    }
    return { ok: false, msg: '该书源目录不可用，已跳过切换' };
  }
  return { ok: true, toc: usableToc };
}
