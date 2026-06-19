export interface LocalLibraryQuery {
  keyword: string;
  category: string;
  page: number;
  pageSize: number;
  offset: number;
}

export function normalizeLocalLibraryQuery(input: Record<string, unknown>): LocalLibraryQuery {
  const keyword = String(input.keyword || input.key || '').trim();
  const category = String(input.category || '').trim();
  const page = Math.max(1, parseInt(String(input.page || '1'), 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(String(input.pageSize || input.limit || '10'), 10) || 10));
  return {
    keyword,
    category,
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function buildLocalLibraryWhere(keyword: string, category = ''): { where: string; params: any[] } {
  const conditions = ['book_url IS NOT NULL', "book_url <> ''"];
  const params: any[] = [];
  const normalizedCategory = String(category || '').trim();
  if (normalizedCategory && normalizedCategory !== '全部') {
    conditions.push('(kind LIKE ? OR category LIKE ?)');
    const categoryLike = `%${normalizedCategory}%`;
    params.push(categoryLike, categoryLike);
  }
  if (keyword) {
    conditions.push('(name LIKE ? OR author LIKE ? OR kind LIKE ? OR origin_name LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like, like, like);
  }
  return {
    where: `WHERE ${conditions.join(' AND ')}`,
    params,
  };
}

function normalizeIdentityText(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^作者\s*[:：]\s*/, '')
    .replace(/[《》<>〈〉【】\[\]「」『』]/g, '')
    .replace(/[\s\u3000\p{P}]+/gu, '')
    .toLowerCase();
}

export function normalizeLocalLibraryIdentityKey(book: any): string {
  const name = normalizeIdentityText(book?.name);
  const author = normalizeIdentityText(book?.author);
  return `${name}|${author}`;
}

function localLibraryBookRank(book: any): [number, number, number] {
  const collectorLocal = Number(book?.isCollectorLocal ?? book?.is_collector_local ?? 0) ? 1 : 0;
  const chapterCount = Number(book?.totalChapterNum ?? book?.total_chapter_num ?? 0) || 0;
  const updatedAt = new Date(book?.updatedAt ?? book?.updated_at ?? 0).getTime() || 0;
  return [collectorLocal, chapterCount, updatedAt];
}

function compareLocalLibraryBook(a: any, b: any): number {
  const left = localLibraryBookRank(a);
  const right = localLibraryBookRank(b);
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

export function dedupeLocalLibraryBooks<T extends Record<string, any>>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = normalizeLocalLibraryIdentityKey(row);
    if (!key || key === '|') continue;
    const current = best.get(key);
    if (!current || compareLocalLibraryBook(row, current) > 0) {
      best.set(key, row);
    }
  }
  return Array.from(best.values()).sort((a, b) => compareLocalLibraryBook(b, a));
}
