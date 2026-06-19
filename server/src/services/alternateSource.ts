import type { SearchBookResult } from './webBookService';

function normalizeText(value: any): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeUrl(value: any): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function isCurrentReadingSource(source: any, book: any, matched: SearchBookResult): boolean {
  const sourceUrl = normalizeUrl(source.book_source_url || source.bookSourceUrl);
  const currentOrigin = normalizeUrl(book.origin);
  const matchedBookUrl = normalizeUrl(matched.bookUrl);
  const currentBookUrl = normalizeUrl(book.book_url || book.bookUrl);

  return Boolean(
    (sourceUrl && currentOrigin && sourceUrl === currentOrigin) ||
    (matchedBookUrl && currentBookUrl && matchedBookUrl === currentBookUrl)
  );
}

export function buildAlternateSourceResult(matched: SearchBookResult, source: any, book: any) {
  return {
    ...matched,
    sourceUrl: source.book_source_url || source.bookSourceUrl,
    sourceName: source.book_source_name || source.bookSourceName,
    matchScore: normalizeText(matched.author) === normalizeText(book.author) ? 2 : 1,
    isCurrentSource: isCurrentReadingSource(source, book, matched),
  };
}
