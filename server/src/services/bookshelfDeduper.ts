function normalizeText(value: any): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function getTimeValue(value: any): number {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function getBookIdentityKey(book: any): string {
  const name = normalizeText(book?.name);
  const author = normalizeText(book?.author);
  if (!name) return '';
  return `${name}|${author}`;
}

export function dedupeBookshelfRows<T extends Record<string, any>>(rows: T[]): T[] {
  const map = new Map<string, T>();
  const passthrough: T[] = [];

  for (const row of rows || []) {
    const key = getBookIdentityKey(row);
    if (!key) {
      passthrough.push(row);
      continue;
    }

    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }

    const currentTime = getTimeValue(row.durChapterTime || row.lastReadTime || row.updatedAt || row.updated_at);
    const existingTime = getTimeValue(existing.durChapterTime || existing.lastReadTime || existing.updatedAt || existing.updated_at);
    if (currentTime >= existingTime) {
      map.set(key, row);
    }
  }

  return [...map.values(), ...passthrough].sort((a, b) => {
    const timeA = getTimeValue(a.durChapterTime || a.lastReadTime || a.updatedAt || a.updated_at);
    const timeB = getTimeValue(b.durChapterTime || b.lastReadTime || b.updatedAt || b.updated_at);
    return timeB - timeA;
  });
}
