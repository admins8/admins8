import { queryOne } from '../config/database';

export interface ReadingSettings {
  guestSearchEnabled: boolean;
  guestReadChapterLimit: number;
}

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  guestSearchEnabled: true,
  guestReadChapterLimit: 3,
};

export function parseBooleanConfig(value: unknown, fallback: boolean): boolean {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}

export function parseGuestReadChapterLimit(value: unknown, fallback = DEFAULT_READING_SETTINGS.guestReadChapterLimit): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < -1) return fallback;
  return normalized;
}

export function canGuestReadChapter(chapterIndex: number, limit: number): boolean {
  if (limit === -1) return true;
  if (limit <= 0) return false;
  return chapterIndex >= 0 && chapterIndex < limit;
}

export function canGuestUseSourceSwitch(chapterIndex: number, limit: number): boolean {
  return canGuestReadChapter(chapterIndex, limit);
}

export async function getReadingSettings(): Promise<ReadingSettings> {
  const [guestSearch, guestLimit] = await Promise.all([
    queryOne('SELECT config_value FROM site_config WHERE config_key = ?', ['guest_search_enabled']),
    queryOne('SELECT config_value FROM site_config WHERE config_key = ?', ['guest_read_chapter_limit']),
  ]);

  return {
    guestSearchEnabled: parseBooleanConfig(guestSearch?.config_value, DEFAULT_READING_SETTINGS.guestSearchEnabled),
    guestReadChapterLimit: parseGuestReadChapterLimit(guestLimit?.config_value),
  };
}
