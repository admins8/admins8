import { isUsableChapter } from './sourceAvailability';

export interface NormalizedChapter {
  title: string;
  url: string;
  index: number;
  [key: string]: any;
}

export interface NormalizeChapterListOptions {
  dedupeTitle?: boolean;
}

function normalizeTitle(title: unknown): string {
  return String(title || '').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(url: unknown): string {
  return String(url || '').trim();
}

export function normalizeChapterList(input: any[], options: NormalizeChapterListOptions = {}): NormalizedChapter[] {
  const result: NormalizedChapter[] = [];
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const dedupeTitle = options.dedupeTitle !== false;

  for (const raw of Array.isArray(input) ? input : []) {
    const title = normalizeTitle(raw?.title);
    const url = normalizeUrl(raw?.url);
    const chapter = { ...raw, title, url };
    if (!isUsableChapter(chapter)) continue;

    const urlKey = url.toLowerCase();
    const titleKey = title.toLowerCase();
    if (seenUrls.has(urlKey) || 