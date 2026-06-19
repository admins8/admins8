export const DEFAULT_PREFETCH_CHAPTER_COUNT = 5;
export const DEFAULT_RUNTIME_CONTENT_TTL_MS = 10 * 60 * 1000;

type RuntimeContentEntry = {
  content: string;
  expiresAt: number;
};

const runtimeChapterContentCache = new Map<string, RuntimeContentEntry>();

function cacheKey(bookUrl: string, chapterIndex: number): string {
  return `${bookUrl}::${chapterIndex}`;
}

export function getPrefetchChapterIndexes(chapterIndex: number, count = DEFAULT_PREFETCH_CHAPTER_COUNT): number[] {
  const start = Math.max(0, Math.floor(Number(chapterIndex)) + 1);
  const total = Math.max(0, Math.floor(Number(count)));
  return Array.from({ length: total }, (_, i) => start + i);
}

export function getRuntimeChapterContent(bookUrl: string, chapterIndex: number, now = Date.now()): string | null {
  const key = cacheKey(bookUrl, chapterIndex);
  const entry = runtimeChapterContentCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    runtimeChapterContentCache.delete(key);
    return null;
  }
  return entry.content;
}

export function setRuntimeChapterContent(
  bookUrl: string,
  chapterIndex: number,
  content: string,
  ttlMs = DEFAULT_RUNTIME_CONTENT_TTL_MS,
  now = Date.now()
): void {
  if (!content) return;
  runtimeChapterContentCache.set(cacheKey(bookUrl, chapterIndex), {
    content,
    expiresAt: now + Math.max(1000, ttlMs),
  });
}

export function clearRuntimeChapterContentCache(): void {
  runtimeChapterContentCache.clear();
}
