export function normalizeSearchText(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[\s\p{P}]/gu, '');
}

export function getSearchMatchScore(keyword: string, bookName: unknown): number {
  const cleanKw = normalizeSearchText(keyword);
  const nameClean = normalizeSearchText(bookName);
  if (!cleanKw || !nameClean) return 0;
  if (nameClean === cleanKw) return 100;
  if (nameClean.startsWith(cleanKw)) return 80;
  if (nameClean.includes(cleanKw)) return 60;
  if (cleanKw.length >= 4) {
    const minLen = Math.max(2, Math.floor(cleanKw.length * 0.7));
    for (let j = 0; j <= cleanKw.length - minLen; j++) {
      if (nameClean.includes(cleanKw.slice(j, j + minLen))) return 30;
    }
  }
  return 0;
}

export type SearchMatchLevel = 'exact' | 'related' | 'weak' | 'none';

export function classifySearchResult(
  keyword: string,
  book: { name?: unknown; author?: unknown }
): { level: SearchMatchLevel; label: string; score: number } {
  const nameScore = getSearchMatchScore(keyword, book.name);
  const nameClean = normalizeSearchText(book.name);
  const keywordClean = normalizeSearchText(keyword);
  const authorClean = normalizeSearchText(book.author);
  const isExactName = !!keywordClean && nameClean === keywordClean;
  const isKnownAuthor = authorClean === normalizeSearchText('天蚕土豆');

  if (isExactName && isKnownAuthor) {
    return { level: 'exact', label: '精确匹配', score: 1000 };
  }
  if (isExactName) {
    return { level: 'exact', label: '同名匹配', score: 900 };
  }
  if (nameScore >= 60) {
    return { level: 'related', label: '相关结果', score: nameScore };
  }
  if (nameScore > 0) {
    return { level: 'weak', label: '弱相关', score: nameScore };
  }
  return { level: 'none', label: '不匹配', score: 0 };
}

function isLikelyImageOrAudioSource(book: { sourceName?: unknown; originName?: unknown; kind?: unknown }): boolean {
  const text = normalizeSearchText(`${book.sourceName || book.originName || ''}${book.kind || ''}`);
  return /漫画|漫蛙|喜漫|favcomic|有声|听书|喜马拉雅|音频/.test(text);
}

function readableSourceScore(book: { sourceName?: unknown; originName?: unknown; kind?: unknown }): number {
  return isLikelyImageOrAudioSource(book) ? -100 : 0;
}

function tocScore(book: { _tocVerified?: unknown }): number {
  return book._tocVerified === true ? 50 : 0;
}

function contentScore(book: { _readable?: unknown; _contentVerified?: unknown }): number {
  return book._readable === true || book._contentVerified === true ? 100 : 0;
}

function localScore(book: { _local?: unknown }): number {
  return book._local === true ? 10000 : 0;
}

export function rankSearchResults<T extends { name?: unknown; author?: unknown; sourceName?: unknown; originName?: unknown; kind?: unknown; _tocVerified?: unknown; _readable?: unknown; _contentVerified?: unknown; _local?: unknown }>(keyword: string, results: T[]): Array<T & { _matchLevel?: string; _matchLabel?: string; _matchScore?: number }> {
  return [...results].map(book => {
    const classification = classifySearchResult(keyword, book);
    return {
      ...book,
      _matchLevel: classification.level,
      _matchLabel: classification.label,
      _matchScore: classification.score,
    };
  }).sort((a, b) => {
    const localDiff = localScore(b) - localScore(a);
    if (localDiff !== 0) return localDiff;
    const scoreDiff = (b._matchScore || 0) - (a._matchScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const contentDiff = contentScore(b) - contentScore(a);
    if (contentDiff !== 0) return contentDiff;
    const tocDiff = tocScore(b) - tocScore(a);
    if (tocDiff !== 0) return tocDiff;
    const readableDiff = readableSourceScore(b) - readableSourceScore(a);
    if (readableDiff !== 0) return readableDiff;
    const aNameLength = normalizeSearchText(a.name).length;
    const bNameLength = normalizeSearchText(b.name).length;
    return aNameLength - bNameLength;
  });
}

export interface AggregatedSearchSource {
  bookUrl: string;
  sourceUrl?: string;
  sourceName?: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  latestChapterTitle?: string;
  wordCount?: string;
  type?: number;
  _tocVerified?: boolean;
  _contentVerified?: boolean;
  _readable?: boolean;
  _matchLevel?: string;
  _matchLabel?: string;
  _matchScore?: number;
}

export type AggregatedSearchResult<T> = T & {
  _aggregateKey: string;
  sourceCount: number;
  sources: AggregatedSearchSource[];
  _local?: boolean;
  _tocVerified?: boolean;
  _contentVerified?: boolean;
  _readable?: boolean;
  _matchLevel?: string;
  _matchLabel?: string;
  _matchScore?: number;
};

export function getAggregateKey(book: { name?: unknown; author?: unknown }): string {
  return `${normalizeSearchText(book.name)}|${normalizeSearchText(book.author)}`;
}

function toAggregatedSource(book: any): AggregatedSearchSource {
  return {
    bookUrl: book.bookUrl || book.book_url || '',
    sourceUrl: book.sourceUrl || book.origin || '',
    sourceName: book.sourceName || book.originName || '',
    coverUrl: book.coverUrl,
    intro: book.intro,
    kind: book.kind,
    latestChapterTitle: book.latestChapterTitle,
    wordCount: book.wordCount,
    type: book.type,
    _tocVerified: book._tocVerified,
    _contentVerified: book._contentVerified,
    _readable: book._readable,
    _matchLevel: book._matchLevel,
    _matchLabel: book._matchLabel,
    _matchScore: book._matchScore,
  };
}

export function aggregateSearchResults<T extends { name?: unknown; author?: unknown; bookUrl?: unknown; sourceUrl?: unknown; sourceName?: unknown }>(
  keyword: string,
  results: T[]
): Array<AggregatedSearchResult<T>> {
  const groups = new Map<string, AggregatedSearchResult<T>>();
  for (const book of rankSearchResults(keyword, results)) {
    const key = getAggregateKey(book);
    if (!key || key === '|') continue;
    const source = toAggregatedSource(book);
    if (!source.bookUrl) continue;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        ...(book as any),
        _aggregateKey: key,
        sourceCount: 1,
        sources: [source],
      });
      continue;
    }
    const duplicated = existing.sources.some((item) =>
      item.bookUrl === source.bookUrl || (!!item.sourceUrl && item.sourceUrl === source.sourceUrl)
    );
    if (!duplicated) {
      existing.sources.push(source);
      existing.sourceCount = existing.sources.length;
    }
  }
  return [...groups.values()].sort((a, b) => {
    const localDiff = localScore(b) - localScore(a);
    if (localDiff !== 0) return localDiff;
    const scoreDiff = classifySearchResult(keyword, b).score - classifySearchResult(keyword, a).score;
    if (scoreDiff !== 0) return scoreDiff;
    const contentDiff = contentScore(b) - contentScore(a);
    if (contentDiff !== 0) return contentDiff;
    const tocDiff = tocScore(b) - tocScore(a);
    if (tocDiff !== 0) return tocDiff;
    const readableDiff = readableSourceScore(b) - readableSourceScore(a);
    if (readableDiff !== 0) return readableDiff;
    const sourceDiff = b.sourceCount - a.sourceCount;
    if (sourceDiff !== 0) return sourceDiff;
    const aNameLength = normalizeSearchText(a.name).length;
    const bNameLength = normalizeSearchText(b.name).length;
    return aNameLength - bNameLength;
  });
}

export function shouldEmitImmediateSearchResult(
  book: { _matchLevel?: unknown; _readable?: unknown; _tocVerified?: unknown },
  options: { forceVerifyToc?: boolean } = {}
): boolean {
  if