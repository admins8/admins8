export type LocalMatchLevel = 'exact' | 'related' | 'weak' | 'none';

export interface LocalBookRow {
  bookUrl?: string;
  book_url?: string;
  name?: string;
  author?: string;
  sourceUrl?: string;
  origin?: string;
  sourceName?: string;
  originName?: string;
  coverUrl?: string;
  cover_url?: string;
  intro?: string;
  kind?: string;
  category?: string;
  latestChapterTitle?: string;
  latest_chapter_title?: string;
  wordCount?: string;
  word_count?: string;
  type?: number;
}

function normalize(value: any): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

export function isSameLocalBook(a: Pick<LocalBookRow, 'name' | 'author'>, b: Pick<LocalBookRow, 'name' | 'author'>): boolean {
  const aName = normalize(a.name);
  const bName = normalize(b.name);
  if (!aName || !bName || aName !== bName) return false;
  const aAuthor = normalize(a.author);
  const bAuthor = normalize(b.author);
  return !aAuthor || !bAuthor || aAuthor === bAuthor;
}

export function buildLocalBookResult(
  row: LocalBookRow,
  match: { matchLevel: LocalMatchLevel; matchLabel: string; matchScore: number }
) {
  const bookUrl = String(row.bookUrl || row.book_url || '').trim();
  const sourceUrl = String(row.sourceUrl || row.origin || '').trim();
  const sourceName = String(row.sourceName || row.originName || '').trim() || '本地书库';
  const coverUrl = row.coverUrl || row.cover_url || '';
  const latestChapterTitle = row.latestChapterTitle || row.latest_chapter_title || '';
  const wordCount = row.wordCount || row.word_count || '';
  const kind = row.kind || row.category || '';
  const aggregateKey = `${normalize(row.name)}|${normalize(row.author)}`;

  return {
    bookUrl,
    name: row.name || '',
    author: row.author || '',
    coverUrl,
    intro: row.intro || '',
    sourceUrl,
    sourceName,
    kind,
    latestChapterTitle,
    wordCount,
    type: row.type,
    _local: true,
    _readable: true,
    _tocVerified: true,
    _matchLevel: match.matchLevel,
    _matchLabel: match.matchLabel,
    _matchScore: match.matchScore,
    _aggregateKey: aggregateKey,
    sourceCount: 1,
    sources: [{
      bookUrl,
      sourceUrl,
      sourceName,
      coverUrl,
      intro: row.intro || '',
      kind,
      latestChapterTitle,
      wordCount,
      type: row.type,
      _local: true,
      _tocVerified: true,
      _readable: true,
      _matchLevel: match.matchLevel,
      _matchLabel: match.matchLabel,
      _matchScore: match.matchScore,
    }],
  };
}
