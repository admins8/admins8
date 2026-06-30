import { isUsableChapter } from './sourceAvailability';

interface ReadableEngine {
  getChapterList(source: any, book: any): Promise<any[]>;
  getContent(source: any, book: any, chapter: any): Promise<string | null>;
}

interface VerifyReadableBookCandidateOptions {
  engine: ReadableEngine;
  source: any;
  book: any;
  timeoutMs: number;
}

interface VerifyReadableSwitchCandidateOptions extends VerifyReadableBookCandidateOptions {
  chapterIndex: number;
}

export interface ReadabilityVerificationResult {
  readable: boolean;
  tocVerified: boolean;
  contentVerified: boolean;
  chapter?: any;
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    task,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), Math.max(1, timeoutMs))),
  ]);
}

function buildBookForReadability(book: any, source: any): any {
  const bookUrl = book.bookUrl || book.book_url;
  return {
    ...book,
    book_url: bookUrl,
    bookUrl,
    toc_url: bookUrl,
    tocUrl: bookUrl,
    origin: source.book_source_url || source.bookSourceUrl || book.origin || book.sourceUrl,
  };
}

async function loadUsableToc(engine: ReadableEngine, source: any, book: any, timeoutMs: number): Promise<any[]> {
  try {
    const toc = await withTimeout(
      engine.getChapterList(source, buildBookForReadability(book, source)),
      timeoutMs,
      []
    );
    return Array.isArray(toc) ? toc.filter(isUsableChapter) : [];
  } catch {
    return [];
  }
}

export async function verifyReadableBookCandidate(options: VerifyReadableBookCandidateOptions): Promise<ReadabilityVerificationResult> {
  const toc = await loadUsableToc(options.engine, options.source, options.book, options.timeoutMs);
  if (!toc.length) {
    return { readable: false, tocVerified: false, contentVerified: false };
  }
  const chapter = toc[0];
  return {
    readable: true,
    tocVerified: true,
    contentVerified: false,
    chapter,
  };
}

export async function verifyReadableSwitchCandidate(options: VerifyReadableSwitchCandidateOptions): Promise<ReadabilityVerificationResult> {
  const toc = await loadUsableToc(options.engine, options.source, options.book, options.timeoutMs);
  if (!toc.length) {
    return { readable: false, tocVerified: false, contentVerified: false };
  }

  const target = Number(options.chapterIndex);
  const chapter = [
    toc.find(ch => Number(ch.index) === target),
    toc.find(ch => Number(ch.index) === target + 1),
    toc.find(ch => Number(ch.index) === target - 1),
    toc[0],
  ].filter(Boolean)[0];

  return { readable: true, tocVerified: true, contentVerified: false, chapter };
}
