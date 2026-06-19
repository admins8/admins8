export const DEFAULT_POPUP_INTERVAL_SECONDS = 3600;
export const DEFAULT_POPUP_AUTO_CLOSE_SECONDS = 10;

export function normalizePopupSeconds(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}
